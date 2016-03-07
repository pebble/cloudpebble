import json

from celery import task
import github

from django.db import transaction
from ide.models.user import User
from ide.models.project import Project
from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier, ResourceVariant
from ide.utils.sdk import dict_to_pretty_json
from ide.utils import generate_half_uuid
from utils.td_helper import send_td_event
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

    project_type = 'native'

    if 'appinfo.json' in files:
        settings = json.loads(files['appinfo.json'].content)
        if 'projectType' in settings:
            project_type = settings['projectType']
        elif len(files) == 2:
            if 'simply.js' in files:
                project_type = 'simplyjs'
            elif 'app.js' in files:
                project_type = 'pebblejs'
    else:
        settings = {}
        if len(files) == 1:
            if 'simply.js' in files:
                project_type = 'simplyjs'
            elif 'app.js' in files:
                project_type = 'pebblejs'

    project_settings = {
        'name': settings.get('longName', default_name),
        'owner': user,
        'app_uuid':  generate_half_uuid(),
        'app_short_name': settings.get('shortName', default_name),
        'app_long_name': settings.get('longName', default_name),
        'app_company_name': settings.get('companyName', user.username),
        'app_version_label': settings.get('versionLabel', '1.0'),
        'app_is_watchface': settings.get('watchapp', {}).get('watchface', False),
        'app_is_hidden': settings.get('watchapp', {}).get('hiddenApp', False),
        'app_is_shown_on_communication': settings.get('watchapp', {}).get('onlyShownOnCommunication', False),
        'app_capabilities': ','.join(settings.get('capabilities', [])),
        'app_keys': dict_to_pretty_json(settings.get('appKeys', {})),
        'app_modern_multi_js': settings.get('enableMultiJS', False),
        'project_type': project_type,
        'sdk_version': settings.get('sdkVersion', '2'),
    }

    with transaction.atomic():
        project = Project.objects.create(**project_settings)

        if project_type != 'simplyjs':
            for filename in gist.files:
                if (project_type == 'native' and filename.endswith('.c') or filename.endswith('.h')) or filename.endswith('.js'):
                    # Because gists can't have subdirectories.
                    if filename == 'pebble-js-app.js':
                        cp_filename = 'js/pebble-js-app.js'
                    else:
                        cp_filename = filename
                    source_file = SourceFile.objects.create(project=project, file_name=cp_filename)
                    source_file.save_file(gist.files[filename].content)

            media = settings.get('resources', {}).get('media', [])
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
            source_file.save_file(gist.files['simply.js'].content)

    send_td_event('cloudpebble_gist_import', data={'data': {'gist_id': gist_id}}, project=project)
    return project.id
