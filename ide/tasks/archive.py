import os
import re
import shutil
import tempfile
import uuid
import zipfile
import json
from celery import task
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import SuspiciousOperation
from django.db import transaction
from ide.utils.project import find_project_root
from ide.utils.sdk import generate_manifest, generate_wscript_file, generate_jshint_file, dict_to_pretty_json
from utils.td_helper import send_td_event

from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier, ResourceVariant
from ide.models.project import Project
import utils.s3 as s3

__author__ = 'katharine'


def add_project_to_archive(z, project, prefix=''):
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    prefix += re.sub(r'[^\w]+', '_', project.name).strip('_').lower()

    for source in source_files:
        src_dir = 'src'
        if project.project_type == 'native':
            if source.target == 'worker':
                src_dir = 'worker_src'
            elif project.app_modern_multi_js and source.file_name.endswith('.js'):
                src_dir = 'src/js'

        z.writestr('%s/%s/%s' % (prefix, src_dir, source.file_name), source.get_contents())

    for resource in resources:
        res_path = 'resources'
        for variant in resource.variants.all():
            z.writestr('%s/%s/%s' % (prefix, res_path, variant.path), variant.get_contents())

    manifest = generate_manifest(project, resources)
    z.writestr('%s/appinfo.json' % prefix, manifest)
    if project.project_type == 'native':
        # This file is always the same, but needed to build.
        z.writestr('%s/wscript' % prefix, generate_wscript_file(project, for_export=True))
        z.writestr('%s/jshintrc' % prefix, generate_jshint_file(project))


@task(acks_late=True)
def create_archive(project_id):
    project = Project.objects.get(pk=project_id)
    prefix = re.sub(r'[^\w]+', '_', project.name).strip('_').lower()
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp:
        filename = temp.name
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            add_project_to_archive(z, project)

        # Generate a URL
        u = uuid.uuid4().hex

        send_td_event('cloudpebble_export_project', project=project)

        if not settings.AWS_ENABLED:
            outfile = '%s%s/%s.zip' % (settings.EXPORT_DIRECTORY, u, prefix)
            os.makedirs(os.path.dirname(outfile), 0755)
            shutil.copy(filename, outfile)
            os.chmod(outfile, 0644)
            return '%s%s/%s.zip' % (settings.EXPORT_ROOT, u, prefix)
        else:
            outfile = '%s/%s.zip' % (u, prefix)
            s3.upload_file('export', outfile, filename, public=True, content_type='application/zip')
            return '%s%s' % (settings.EXPORT_ROOT, outfile)


@task(acks_late=True)
def export_user_projects(user_id):
    user = User.objects.get(pk=user_id)
    projects = Project.objects.filter(owner=user)
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp:
        filename = temp.name
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for project in projects:
                add_project_to_archive(z, project, prefix='cloudpebble-export/')

        # Generate a URL
        u = uuid.uuid4().hex
        outfile = '%s%s/%s.zip' % (settings.EXPORT_DIRECTORY, u, 'cloudpebble-export')
        os.makedirs(os.path.dirname(outfile), 0755)
        shutil.copy(filename, outfile)
        os.chmod(outfile, 0644)

        send_td_event('cloudpebble_export_all_projects', user=user)
        return '%s%s/%s.zip' % (settings.EXPORT_ROOT, u, 'cloudpebble-export')


def get_filename_variant(file_name, resource_suffix_map):
    # Given a filename
    # Get a list of variant IDs, and the root file name
    file_name_parts = os.path.splitext(file_name)
    if file_name_parts[0] == '~':
        raise Exception('Cannot start a file name with a ~ character')
    split = file_name_parts[0].split("~")
    tags = split[1:]
    try:
        ids = [resource_suffix_map['~'+tag] for tag in tags]
    except KeyError as key:
        raise ValueError('Unrecognised tag %s' % key)
    root_file_name = split[0] + file_name_parts[1]
    return ids, root_file_name


def make_filename_variant(file_name, variant):
    file_name_parts = os.path.splitext(file_name)
    return file_name_parts[0] + variant + file_name_parts[1]


@task(acks_late=True)
def do_import_archive(project_id, archive, delete_project=False):
    project = Project.objects.get(pk=project_id)
    try:
        with tempfile.NamedTemporaryFile(suffix='.zip') as archive_file:
            archive_file.write(archive)
            archive_file.flush()
            with zipfile.ZipFile(str(archive_file.name), 'r') as z:
                contents = z.infolist()
                # Requirements:
                # - Find the folder containing the project. This may or may not be at the root level.
                # - Read in the source files, resources and resource map.
                # Observations:
                # - Legal projects must keep their source in a directory called 'src' containing at least one *.c file.
                # - Legal projects must have a resource map at resources/src/resource_map.json
                # Strategy:
                # - Find the shortest common prefix for 'resources/src/resource_map.json' and 'src/'.
                #   - This is taken to be the project directory.
                # - Import every file in 'src/' with the extension .c or .h as a source file
                # - Parse resource_map.json and import files it references
                MANIFEST = 'appinfo.json'
                SRC_DIR = 'src/'
                WORKER_SRC_DIR = 'worker_src/'
                RES_PATH = 'resources'

                if len(contents) > 400:
                    raise Exception("Too many files in zip file.")
                file_list = [x.filename for x in contents]


                base_dir = find_project_root(file_list)
                dir_end = len(base_dir)

                def make_valid_filename(zip_entry):
                    entry_filename = zip_entry.filename
                    if entry_filename[:dir_end] != base_dir:
                        return False
                    entry_filename = entry_filename[dir_end:]
                    if entry_filename == '':
                        return False
                    if not os.path.normpath('/SENTINEL_DO_NOT_ACTUALLY_USE_THIS_NAME/%s' % entry_filename).startswith('/SENTINEL_DO_NOT_ACTUALLY_USE_THIS_NAME/'):
                        raise SuspiciousOperation("Invalid zip file contents.")
                    if zip_entry.file_size > 5242880:  # 5 MB
                        raise Exception("Excessively large compressed file.")
                    return entry_filename

                # Now iterate over the things we found
                with transaction.atomic():
                    for entry in contents:
                        filename = make_valid_filename(entry)
                        if not filename:
                            continue

                        if filename == MANIFEST:
                            # We have a resource map! We can now try importing things from it.
                            with z.open(entry) as f:
                                m = json.loads(f.read())

                            project.app_uuid = m['uuid']
                            project.app_short_name = m['shortName']
                            project.app_long_name = m['longName']
                            project.app_company_name = m['companyName']
                            project.app_version_label = m['versionLabel']
                            project.sdk_version = m.get('sdkVersion', '2')
                            project.app_is_watchface = m.get('watchapp', {}).get('watchface', False)
                            project.app_is_hidden = m.get('watchapp', {}).get('hiddenApp', False)
                            project.app_is_shown_on_communication = m.get('watchapp', {}).get('onlyShownOnCommunication', False)
                            project.app_capabilities = ','.join(m.get('capabilities', []))
                            project.app_modern_multi_js = m.get('enableMultiJS', False)
                            if 'targetPlatforms' in m:
                                project.app_platforms = ','.join(m['targetPlatforms'])
                            project.app_keys = dict_to_pretty_json(m.get('appKeys', {}))
                            project.project_type = m.get('projectType', 'native')
                            if project.project_type not in [x[0] for x in Project.PROJECT_TYPES]:
                                raise Exception("Illegal project type %s" % project.project_type)
                            media_map = m['resources']['media']

                            tag_map = {v: k for k, v in ResourceVariant.VARIANT_STRINGS.iteritems() if v}

                            desired_resources = {}
                            resources_files = {}
                            resource_variants = {}
                            file_exists_for_root = {}

                            # Go through the media map and look for resources
                            for resource in media_map:
                                file_name = resource['file']
                                identifier = resource['name']
                                # Pebble.js and simply.js both have some internal resources that we don't import.
                                if project.project_type in {'pebblejs', 'simplyjs'}:
                                    if identifier in {'MONO_FONT_14', 'IMAGE_MENU_ICON', 'IMAGE_LOGO_SPLASH', 'IMAGE_TILE_SPLASH'}:
                                        continue
                                tags, root_file_name = get_filename_variant(file_name, tag_map)
                                if (len(tags) != 0):
                                    raise ValueError("Generic resource filenames cannot contain a tilde (~)")
                                if file_name not in desired_resources:
                                    desired_resources[root_file_name] = []
                                print "Desired resource: %s" % root_file_name
                                desired_resources[root_file_name].append(resource)
                                file_exists_for_root[root_file_name] = False

                            for zipitem in contents:
                                # Let's just try opening the file
                                filename = make_valid_filename(zipitem)
                                if filename is False or not filename.startswith(RES_PATH):
                                    continue
                                filename = filename[len(RES_PATH)+1:]
                                try:
                                    extracted = z.open("%s%s/%s"%(base_dir, RES_PATH, filename))
                                except KeyError:
                                    print "Failed to open %s" % filename
                                    continue

                                # Now we know the file exists and is in the resource directory - is it one we want?
                                tags, root_file_name = get_filename_variant(filename, tag_map)
                                tags_string = ",".join(str(int(t)) for t in tags)

                                print "Importing file %s with root %s " % (zipitem.filename, root_file_name)

                                if root_file_name in desired_resources:
                                    medias = desired_resources[root_file_name]
                                    print "Looking for variants of %s" % root_file_name

                                    # Because 'kind' and 'is_menu_icons' are properties of ResourceFile in the database,
                                    # we just use the first one.
                                    resource = medias[0]
                                    # Make only one resource file per base resource.
                                    if root_file_name not in resources_files:
                                        kind = resource['type']
                                        is_menu_icon = resource.get('menuIcon', False)
                                        resources_files[root_file_name] = ResourceFile.objects.create(
                                            project=project,
                                            file_name=os.path.basename(root_file_name),
                                            kind=kind,
                                            is_menu_icon=is_menu_icon)

                                    # But add a resource variant for every file
                                    print "Adding variant %s with tags [%s]" % (root_file_name, tags_string)
                                    actual_file_name = resource['file']
                                    resource_variants[actual_file_name] = ResourceVariant.objects.create(resource_file=resources_files[root_file_name], tags=tags_string)
                                    resource_variants[actual_file_name].save_file(extracted)
                                    file_exists_for_root[root_file_name] = True

                            # Now add all the resource identifiers
                            for root_file_name in desired_resources:
                                for resource in desired_resources[root_file_name]:
                                    target_platforms = json.dumps(resource['targetPlatforms']) if 'targetPlatforms' in resource else None
                                    ResourceIdentifier.objects.create(
                                        resource_file=resources_files[root_file_name],
                                        resource_id=resource['name'],
                                        target_platforms=target_platforms,
                                        # Font options
                                        character_regex=resource.get('characterRegex', None),
                                        tracking=resource.get('trackingAdjust', None),
                                        compatibility=resource.get('compatibility', None),
                                        # Bitmap options
                                        memory_format=resource.get('memoryFormat', None),
                                        storage_format=resource.get('storageFormat', None),
                                        space_optimisation=resource.get('spaceOptimization', None)
                                    )

                            # Check that at least one variant of each specified resource exists.
                            for root_file_name, loaded in file_exists_for_root.iteritems():
                                if not loaded:
                                    raise KeyError("No file was found to satisfy the manifest filename: {}".format(root_file_name))

                        elif filename.startswith(SRC_DIR):
                            if (not filename.startswith('.')) and (filename.endswith('.c') or filename.endswith('.h') or filename.endswith('.js')):
                                base_filename = filename[len(SRC_DIR):]
                                if project.app_modern_multi_js and filename.endswith('.js') and filename.startswith('js/'):
                                    base_filename = base_filename[len('js/'):]
                                source = SourceFile.objects.create(project=project, file_name=base_filename)
                                with z.open(entry.filename) as f:
                                    source.save_file(f.read().decode('utf-8'))
                        elif filename.startswith(WORKER_SRC_DIR):
                            if (not filename.startswith('.')) and (filename.endswith('.c') or filename.endswith('.h') or filename.endswith('.js')):
                                base_filename = filename[len(WORKER_SRC_DIR):]
                                source = SourceFile.objects.create(project=project, file_name=base_filename, target='worker')
                                with z.open(entry.filename) as f:
                                    source.save_file(f.read().decode('utf-8'))
                    project.save()
                    send_td_event('cloudpebble_zip_import_succeeded', project=project)

        # At this point we're supposed to have successfully created the project.
        return True
    except Exception as e:
        if delete_project:
            try:
                Project.objects.get(pk=project_id).delete()
            except:
                pass
        send_td_event('cloudpebble_zip_import_failed', data={
            'data': {
                'reason': e.message
            }
        }, user=project.owner)
        raise


class NoProjectFoundError(Exception):
    pass
