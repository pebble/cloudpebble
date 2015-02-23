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
from utils.keen_helper import send_keen_event

from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier, ResourceVariant
from ide.models.project import Project
import utils.s3 as s3

__author__ = 'katharine'


def add_project_to_archive(z, project, prefix=''):
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    prefix += re.sub(r'[^\w]+', '_', project.name).strip('_').lower()

    for source in source_files:
        src_dir = 'worker_src' if source.target == 'worker' else 'src'
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

        send_keen_event('cloudpebble', 'cloudpebble_export_project', project=project)

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

        send_keen_event('cloudpebble', 'cloudpebble_export_all_projects', user=user)
        return '%s%s/%s.zip' % (settings.EXPORT_ROOT, u, 'cloudpebble-export')


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
                if len(contents) > 400:
                    raise Exception("Too many files in zip file.")
                file_list = [x.filename for x in contents]

                base_dir = find_project_root(file_list)
                dir_end = len(base_dir)

                # Now iterate over the things we found
                with transaction.commit_on_success():
                    for entry in contents:
                        filename = entry.filename
                        if filename[:dir_end] != base_dir:
                            continue
                        filename = filename[dir_end:]
                        if filename == '':
                            continue
                        if not os.path.normpath('/SENTINEL_DO_NOT_ACTUALLY_USE_THIS_NAME/%s' % filename).startswith('/SENTINEL_DO_NOT_ACTUALLY_USE_THIS_NAME/'):
                            raise SuspiciousOperation("Invalid zip file contents.")
                        if entry.file_size > 5242880:  # 5 MB
                            raise Exception("Excessively large compressed file.")

                        if filename == MANIFEST:
                            # We have a resource map! We can now try importing things from it.
                            with z.open(entry) as f:
                                m = json.loads(f.read())

                            project.app_uuid = m['uuid']
                            project.app_short_name = m['shortName']
                            project.app_long_name = m['longName']
                            project.app_company_name = m['companyName']
                            project.app_version_code = m['versionCode']
                            project.app_version_label = m['versionLabel']
                            project.app_is_watchface = m.get('watchapp', {}).get('watchface', False)
                            project.app_capabilities = ','.join(m.get('capabilities', []))
                            project.app_keys = dict_to_pretty_json(m.get('appKeys', {}))
                            project.project_type = m.get('projectType', 'native')
                            if project.project_type not in [x[0] for x in Project.PROJECT_TYPES]:
                                raise Exception("Illegal project type %s" % project.project_type)
                            media_map = m['resources']['media']

                            resources = {}
                            resource_files = {}
                            resource_suffix_map = {v: k for k, v in ResourceVariant.VARIANT_SUFFIXES.iteritems()}
                            del resource_suffix_map['']  # This mapping is confusing to keep around; everything is suffixed with nothing.
                            for resource in media_map:
                                kind = resource['type']
                                def_name = resource['name']
                                file_name = resource['file']
                                # Pebble.js and simply.js both have some internal resources that we don't import.
                                if project.project_type in {'pebblejs', 'simplyjs'}:
                                    if def_name in {'MONO_FONT_14', 'IMAGE_MENU_ICON', 'IMAGE_LOGO_SPLASH', 'IMAGE_TILE_SPLASH'}:
                                        continue
                                regex = resource.get('characterRegex', None)
                                tracking = resource.get('trackingAdjust', None)
                                is_menu_icon = resource.get('menuIcon', False)
                                compatibility = resource.get('compatibility', None)
                                if file_name not in resource_files:
                                    file_name_parts = os.path.splitext(file_name)
                                    for suffix in resource_suffix_map.iterkeys():
                                        if file_name_parts[0].endswith(suffix):
                                            root_file_name = file_name_parts[0][:len(file_name_parts[0]) - len(suffix)] + "." + file_name_parts[1]
                                            variant = resource_suffix_map[suffix]
                                            break
                                    else:
                                        root_file_name = file_name
                                        variant = ResourceVariant.VARIANT_DEFAULT
                                    if root_file_name not in resources:
                                        resources[root_file_name] = ResourceFile.objects.create(project=project, file_name=os.path.basename(root_file_name), kind=kind, is_menu_icon=is_menu_icon)
                                    res_path = 'resources'
                                    resource_files[file_name] = ResourceVariant.objects.create(resource_file=resources[root_file_name], variant=variant)
                                    resource_files[file_name].save_file(z.open('%s%s/%s' % (base_dir, res_path, file_name)))
                                ResourceIdentifier.objects.create(
                                    resource_file=resources[file_name],
                                    resource_id=def_name,
                                    character_regex=regex,
                                    tracking=tracking,
                                    compatibility=compatibility
                                )

                        elif filename.startswith(SRC_DIR):
                            if (not filename.startswith('.')) and (filename.endswith('.c') or filename.endswith('.h') or filename.endswith('.js')):
                                base_filename = filename[len(SRC_DIR):]
                                source = SourceFile.objects.create(project=project, file_name=base_filename)
                                with z.open(entry.filename) as f:
                                    source.save_file(f.read().decode('utf-8'))
                    project.save()
                    send_keen_event('cloudpebble', 'cloudpebble_zip_import_succeeded', project=project)

        # At this point we're supposed to have successfully created the project.
        return True
    except Exception as e:
        if delete_project:
            try:
                Project.objects.get(pk=project_id).delete()
            except:
                pass
        send_keen_event('cloudpebble', 'cloudpebble_zip_import_failed', user=project.owner, data={
            'data': {
                'reason': e.message
            }
        })
        raise


class NoProjectFoundError(Exception):
    pass