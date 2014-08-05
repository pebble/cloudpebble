import json

from celery import task
import github

from django.db import transaction
from ide.models.user import User
from ide.models.project import Project
from ide.models.files import SourceFile, ResourceFile, ResourceIdentifier
from ide.utils.sdk import dict_to_pretty_json
from ide.utils import generate_half_uuid
from utils.keen_helper import send_keen_event
import urllib2

@task(acks_late=True)
def import_gist(user_id, gist_id):
    user = User.objects.get(pk=user_id)
    g = github.Github()

    try:
        gist = g.get_gist(gist_id)
    except github.UnknownObjectException:
        send_keen_event('cloudpebble', 'cloudpebble_gist_not_found', user=user, data={'data': {'gist_id': gist_id}})
        raise Exception("Couldn't find gist to import.")

    files = gist.files
    default_name = gist.description or 'Sample project'

    is_native = True

    if 'appinfo.json' in files:
        settings = json.loads(files['appinfo.json'].content)
        if len(files) == 2 and 'simply.js' in files:
            is_native = False
    else:
        settings = {}
        if len(files) == 1 and 'simply.js' in files:
            is_native = False

    project_settings = {
        'name': settings.get('longName', default_name),
        'owner': user,
        'app_uuid':  generate_half_uuid(),
        'app_short_name': settings.get('shortName', default_name),
        'app_long_name': settings.get('longName', default_name),
        'app_company_name': settings.get('companyName', user.username),
        'app_version_code': 1,
        'app_version_label': settings.get('versionLabel', '1.0'),
        'app_is_watchface': settings.get('watchapp', {}).get('watchface', False),
        'app_capabilities': ','.join(settings.get('capabilities', [])),
        'app_keys': dict_to_pretty_json(settings.get('appKeys', {})),
        'project_type': 'native' if is_native else 'simplyjs'
    }

    with transaction.commit_on_success():
        project = Project.objects.create(**project_settings)

        if is_native:
            for filename in gist.files:
                if filename.endswith('.c') or filename.endswith('.h') or filename.endswith('.js'):
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
                is_menu_icon = resource.get('menuIcon', False)
                if filename not in gist.files:
                    continue

                if filename not in resources:
                    resources[filename] = ResourceFile.objects.create(project=project, file_name=filename, kind=kind,
                                                                      is_menu_icon=is_menu_icon)
                    # We already have this as a unicode string in .content, but it shouldn't have become unicode
                    # in the first place.
                    resources[filename].save_file(urllib2.urlopen(gist.files[filename].raw_url))
                ResourceIdentifier.objects.create(
                    resource_file=resources[filename],
                    resource_id=def_name,
                    character_regex=regex,
                    tracking=tracking
                )
        else:
            source_file = SourceFile.objects.create(project=project, file_name='app.js')
            source_file.save_file(gist.files['simply.js'].content)

    send_keen_event('cloudpebble', 'cloudpebble_gist_import', project=project, data={'data': {'gist_id': gist_id}})
    return project.id
