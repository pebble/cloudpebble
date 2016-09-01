import json

import github
from celery import task
from django.db import transaction
from django.conf import settings

from ide.models.user import User
from ide.models.project import Project
from ide.utils.sdk import load_manifest_dict
from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier, ResourceVariant
from ide.utils.project import APPINFO_MANIFEST, PACKAGE_MANIFEST
from ide.utils import generate_half_uuid
from utils.td_helper import send_td_event
from collections import defaultdict
import urllib2


@task(acks_late=True)
def import_gist(user_id, gist_id):
    user = User.objects.get(pk=user_id)
    g = github.Github()

    try:
        gist = g.get_gist(gist_id)
    except github.UnknownObjectException:
        send_td_event('cloudpebble_gist_not_found', data={'data': {'gist_id': gist_id}}, user=user)
        raise Exception("Couldn't find gist to import.")

    files = gist.files
    default_name = gist.description or 'Sample project'

    default_settings = {
        'name': default_name,
        'app_short_name': default_name,
        'app_long_name': default_name,
        'app_company_name': user.username,
        'app_version_label': '1.0',
        'app_is_watchface': False,
        'app_is_hidden': False,
        'app_is_shown_on_communication': False,
        'app_capabilities': '[]',
        'app_keys': '{}',
        'project_type': 'native',
        'app_modern_multi_js': False,
        'sdk_version': '2'
    }
    if len(files) == 1 or ((APPINFO_MANIFEST in files or PACKAGE_MANIFEST in files) and len(files) == 2):
        if 'simply.js' in files:
            default_settings['project_type'] = 'simplyjs'
        elif 'app.js' in files:
            default_settings['project_type'] = 'pebblejs'
        elif 'index.js' in files:
            default_settings['project_type'] = 'rocky'

    # If all files are .js or .json and there is an index.js, assume it's a rocky project.
    if all(x.endswith(('.js', '.json')) for x in gist.files) and 'index.js' in files:
        default_settings['project_type'] = 'rocky'
        default_settings['sdk_version'] = '3'
        default_settings['app_modern_multi_js'] = True

    media = []

    # Using defaultdict we can load project settings from a manifest dict which
    # has values that default to None. This way, we can delegate
    if PACKAGE_MANIFEST in files:
        content = json.loads(files[PACKAGE_MANIFEST].content)
        package = defaultdict(lambda: None)
        package.update(content)
        package['pebble'] = defaultdict(lambda: None)
        package['pebble'].update(content.get('pebble', {}))
        manifest_settings, media, dependencies = load_manifest_dict(package, PACKAGE_MANIFEST, default_project_type=None)
        default_settings['app_keys'] = '[]'
        default_settings['sdk_version'] = '3'
        default_settings['app_modern_multi_js'] = True
    elif APPINFO_MANIFEST in files:
        content = json.loads(files[APPINFO_MANIFEST].content)
        package = defaultdict(lambda: None)
        package.update(content)
        manifest_settings, media, dependencies = load_manifest_dict(package, APPINFO_MANIFEST, default_project_type=None)
    else:
        manifest_settings = {}
        dependencies = {}

    fixed_settings = {
        'owner': user,
        'app_uuid': generate_half_uuid()
    }

    project_settings = {}
    project_settings.update(default_settings)
    project_settings.update({k: v for k, v in manifest_settings.iteritems() if v is not None})
    project_settings.update(fixed_settings)

    with transaction.atomic():
        project = Project.objects.create(**project_settings)
        project.set_dependencies(dependencies)
        project_type = project.project_type

        if project_type == 'package':
            raise Exception("Gist imports are not yet support for packages.")

        if project_type != 'simplyjs':
            for filename in gist.files:
                target = 'app'
                if not filename.endswith(('.c', '.h', '.js', '.json')):
                    continue
                if filename in ('appinfo.json', 'package.json'):
                    continue
                if project_type == 'native':
                    if filename.endswith(('.js', '.json')):
                        target = 'pkjs'
                elif project_type == 'rocky':
                    if filename == 'app.js':
                        target = 'pkjs'
                source_file = SourceFile.objects.create(project=project, file_name=filename, target=target)
                source_file.save_text(gist.files[filename].content)

            resources = {}
            for resource in media:
                kind = resource['type']
                def_name = resource['name']
                filename = resource['file']
                regex = resource.get('characterRegex', None)
                tracking = resource.get('trackingAdjust', None)
                memory_format = resource.get('memoryFormat', None)
                storage_format = resource.get('storageFormat', None)
                space_optimisation = resource.get('spaceOptimization', None)
                is_menu_icon = resource.get('menuIcon', False)
                compatibility = resource.get('compatibility', None)
                if filename not in gist.files:
                    continue

                if filename not in resources:
                    resources[filename] = ResourceFile.objects.create(project=project, file_name=filename, kind=kind,
                                                                      is_menu_icon=is_menu_icon)
                    # We already have this as a unicode string in .content, but it shouldn't have become unicode
                    # in the first place.
                    default_variant = ResourceVariant.objects.create(resource_file=resources[filename], tags=ResourceVariant.TAGS_DEFAULT)
                    default_variant.save_file(urllib2.urlopen(gist.files[filename].raw_url))
                ResourceIdentifier.objects.create(
                    resource_file=resources[filename],
                    resource_id=def_name,
                    character_regex=regex,
                    tracking=tracking,
                    compatibility=compatibility,
                    memory_format=memory_format,
                    storage_format=storage_format,
                    space_optimisation=space_optimisation
                )
        else:
            source_file = SourceFile.objects.create(project=project, file_name='app.js')
            source_file.save_text(gist.files['simply.js'].content)

    send_td_event('cloudpebble_gist_import', data={'data': {'gist_id': gist_id}}, project=project)
    return project.id
