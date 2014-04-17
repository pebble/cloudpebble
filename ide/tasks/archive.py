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
from ide.utils.sdk import generate_resource_map, generate_v2_manifest, generate_wscript_file, generate_jshint_file, \
    dict_to_pretty_json
from utils.keen_helper import send_keen_event

from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier
from ide.models.project import Project
import utils.s3 as s3

__author__ = 'katharine'


def add_project_to_archive(z, project, prefix=''):
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    prefix += re.sub(r'[^\w]+', '_', project.name).strip('_').lower()

    for source in source_files:
        z.writestr('%s/src/%s' % (prefix, source.file_name), source.get_contents())

    for resource in resources:
        res_path = 'resources/src' if project.sdk_version == '1' else 'resources'
        z.writestr('%s/%s/%s' % (prefix, res_path, resource.path), resource.get_contents())

    if project.sdk_version == '1':
        resource_map = generate_resource_map(project, resources)
        z.writestr('%s/resources/src/resource_map.json' % prefix, resource_map)
    else:
        manifest = generate_v2_manifest(project, resources)
        z.writestr('%s/appinfo.json' % prefix, manifest)
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
            return 'https://%s.s3.amazonaws.com/%s' % (settings.AWS_S3_EXPORT_BUCKET, outfile)




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
def do_import_archive(project_id, archive_location, delete_zip=False, delete_project=False):
    project = Project.objects.get(pk=project_id)
    try:
        # archive_location *must not* be a file-like object. We ensure this by string casting.
        archive_location = str(archive_location)
        if not zipfile.is_zipfile(archive_location):
            raise NoProjectFoundError("The file is not a zip file.")

        with zipfile.ZipFile(str(archive_location), 'r') as z:
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
            RESOURCE_MAP = 'resources/src/resource_map.json'
            MANIFEST = 'appinfo.json'
            SRC_DIR = 'src/'
            if len(contents) > 200:
                raise Exception("Too many files in zip file.")
            file_list = [x.filename for x in contents]

            version, base_dir = find_project_root(file_list)
            dir_end = len(base_dir)
            project.sdk_version = version

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

                    if (filename == RESOURCE_MAP and version == '1') or (filename == MANIFEST and version == '2'):
                        # We have a resource map! We can now try importing things from it.
                        with z.open(entry) as f:
                            m = json.loads(f.read())

                        if version == '1':
                            project.version_def_name = m['versionDefName']
                            media_map = m['media']
                        elif version == '2':
                            project.app_uuid = m['uuid']
                            project.app_short_name = m['shortName']
                            project.app_long_name = m['longName']
                            project.app_company_name = m['companyName']
                            project.app_version_code = m['versionCode']
                            project.app_version_label = m['versionLabel']
                            project.app_is_watchface = m.get('watchapp', {}).get('watchface', False)
                            project.app_capabilities = ','.join(m.get('capabilities', []))
                            project.app_keys = dict_to_pretty_json(m.get('appKeys', {}))
                            media_map = m['resources']['media']

                        resources = {}
                        for resource in media_map:
                            kind = resource['type']
                            def_name = resource['defName'] if version == '1' else resource['name']
                            file_name = resource['file']
                            regex = resource.get('characterRegex', None)
                            tracking = resource.get('trackingAdjust', None)
                            is_menu_icon = resource.get('menuIcon', False)
                            if file_name not in resources:
                                resources[file_name] = ResourceFile.objects.create(project=project, file_name=os.path.basename(file_name), kind=kind, is_menu_icon=is_menu_icon)
                                res_path = 'resources/src' if version == '1' else 'resources'
                                resources[file_name].save_file(z.open('%s%s/%s' % (base_dir, res_path, file_name)))
                            ResourceIdentifier.objects.create(
                                resource_file=resources[file_name],
                                resource_id=def_name,
                                character_regex=regex,
                                tracking=tracking
                            )

                    elif filename.startswith(SRC_DIR):
                        if (not filename.startswith('.')) and (filename.endswith('.c') or filename.endswith('.h') or filename.endswith('js/pebble-js-app.js')):
                            base_filename = os.path.basename(filename) if not filename.endswith('.js') else 'js/pebble-js-app.js'
                            source = SourceFile.objects.create(project=project, file_name=base_filename)
                            with z.open(entry.filename) as f:
                                source.save_file(f.read().decode('utf-8'))
                project.save()
                send_keen_event('cloudpebble', 'cloudpebble_zip_import_succeeded', project=project)

        # At this point we're supposed to have successfully created the project.
        if delete_zip:
            try:
                os.unlink(archive_location)
            except OSError:
                print "Unable to remove archive at %s." % archive_location
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