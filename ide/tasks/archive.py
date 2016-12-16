import json
import logging
import os
import re
import shutil
import tempfile
import uuid
import zipfile

from celery import shared_task
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import SuspiciousOperation
from django.db import transaction

import utils.s3 as s3
from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier, ResourceVariant
from ide.models.project import Project
from ide.utils.project import find_project_root_and_manifest, InvalidProjectArchiveException, MANIFEST_KINDS, BaseProjectItem
from ide.utils.sdk import generate_manifest, generate_wscript_file, generate_jshint_file, manifest_name_for_project, load_manifest_dict
from utils.td_helper import send_td_event

__author__ = 'katharine'

logger = logging.getLogger(__name__)


def add_project_to_archive(z, project, prefix='', suffix=''):
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    prefix += re.sub(r'[^\w]+', '_', project.name).strip('_').lower()
    prefix += suffix

    for source in source_files:
        path = os.path.join(prefix, source.project_path)
        z.writestr(path, source.get_contents())

    for resource in resources:
        for variant in resource.variants.all():
            z.writestr('%s/%s/%s' % (prefix, project.resources_path, variant.path), variant.get_contents())

    manifest = generate_manifest(project, resources)
    manifest_name = manifest_name_for_project(project)
    z.writestr('%s/%s' % (prefix, manifest_name), manifest)
    if project.is_standard_project_type:
        # This file is always the same, but needed to build.
        z.writestr('%s/wscript' % prefix, generate_wscript_file(project, for_export=True))
        z.writestr('%s/jshintrc' % prefix, generate_jshint_file(project))


@shared_task(acks_late=True)
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


@shared_task(acks_late=True)
def export_user_projects(user_id):
    user = User.objects.get(pk=user_id)
    projects = Project.objects.filter(owner=user)
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp:
        filename = temp.name
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for project in projects:
                add_project_to_archive(z, project, prefix='cloudpebble-export/', suffix='-%d' % project.id)

        send_td_event('cloudpebble_export_all_projects', user=user)

        # Generate a URL
        u = uuid.uuid4().hex
        if not settings.AWS_ENABLED:
            outfile = '%s%s/%s.zip' % (settings.EXPORT_DIRECTORY, u, 'cloudpebble-export')
            os.makedirs(os.path.dirname(outfile), 0755)
            shutil.copy(filename, outfile)
            os.chmod(outfile, 0644)
            return '%s%s/%s.zip' % (settings.EXPORT_ROOT, u, 'cloudpebble-export')
        else:
            outfile = '%s/%s.zip' % (u, 'cloudpebble-export')
            s3.upload_file('export', outfile, filename, public=True, content_type='application/zip')
            return '%s%s' % (settings.EXPORT_ROOT, outfile)


def get_filename_variant(file_name, resource_suffix_map):
    # Given a filename
    # Get a list of variant IDs, and the root file name
    file_name_parts = os.path.splitext(file_name)
    if file_name_parts[0] == '~':
        raise Exception('Cannot start a file name with a ~ character')
    split = file_name_parts[0].split("~")
    tags = split[1:]
    try:
        ids = [resource_suffix_map['~' + tag] for tag in tags]
    except KeyError as key:
        raise ValueError('Unrecognised tag %s' % key)
    root_file_name = split[0] + file_name_parts[1]
    return ids, root_file_name


def make_filename_variant(file_name, variant):
    file_name_parts = os.path.splitext(file_name)
    return file_name_parts[0] + variant + file_name_parts[1]


class ArchiveProjectItem(BaseProjectItem):
    def __init__(self, zip_file, entry):
        self.entry = entry
        self.zip_file = zip_file

    def read(self):
        with self.zip_file.open(self.entry) as f:
            return f.read()

    @property
    def path(self):
        return self.entry.filename


@shared_task(acks_late=True)
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
                SRC_DIR = 'src/'
                WORKER_SRC_DIR = 'worker_src/'
                INCLUDE_SRC_DIR = 'include/'

                if len(contents) > 400:
                    raise InvalidProjectArchiveException("Too many files in zip file.")

                archive_items = [ArchiveProjectItem(z, x) for x in contents]
                base_dir, manifest_item = find_project_root_and_manifest(archive_items)
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
                        raise InvalidProjectArchiveException("Excessively large compressed file.")
                    return entry_filename

                manifest_kind = make_valid_filename(manifest_item.entry)
                manifest_dict = json.loads(manifest_item.read())

                # Now iterate over the things we found, filter out invalid files and look for the manifest.
                filtered_contents = []
                for entry in contents:
                    filename = make_valid_filename(entry)
                    if not filename or filename in MANIFEST_KINDS:
                        continue
                    else:
                        filtered_contents.append((filename, entry))

                with transaction.atomic():
                    # We have a resource map! We can now try importing things from it.
                    project_options, media_map, dependencies = load_manifest_dict(manifest_dict, manifest_kind)

                    for k, v in project_options.iteritems():
                        setattr(project, k, v)
                    project.full_clean()
                    project.set_dependencies(dependencies)

                    RES_PATH = project.resources_path

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

                        desired_resources[root_file_name].append(resource)
                        file_exists_for_root[root_file_name] = False

                    # Go through the zip file process all resource and source files.
                    for filename, entry in filtered_contents:
                        if filename.startswith(RES_PATH):
                            base_filename = filename[len(RES_PATH) + 1:]
                            # Let's just try opening the file
                            try:
                                extracted = z.open("%s%s/%s" % (base_dir, RES_PATH, base_filename))
                            except KeyError:
                                logger.debug("Failed to open %s", base_filename)
                                continue

                            # Now we know the file exists and is in the resource directory - is it the one we want?
                            tags, root_file_name = get_filename_variant(base_filename, tag_map)
                            tags_string = ",".join(str(int(t)) for t in tags)

                            if root_file_name in desired_resources:
                                medias = desired_resources[root_file_name]

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
                                actual_file_name = resource['file']
                                resource_variants[actual_file_name] = ResourceVariant.objects.create(resource_file=resources_files[root_file_name], tags=tags_string)
                                resource_variants[actual_file_name].save_file(extracted)
                                file_exists_for_root[root_file_name] = True
                        else:
                            try:
                                base_filename, target = SourceFile.get_details_for_path(project.project_type, filename)
                            except ValueError:
                                # We'll just ignore any out of place files.
                                continue
                            source = SourceFile.objects.create(project=project, file_name=base_filename, target=target)

                            with z.open(entry.filename) as f:
                                source.save_text(f.read().decode('utf-8'))

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
                'reason': str(e)
            }
        }, user=project.owner)
        raise
