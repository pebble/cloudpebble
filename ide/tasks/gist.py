import json

from celery import task
import github

from django.db import transaction
from ide.models.user import User
from ide.models.project import Project
from ide.models.files import SourceFile
from ide.utils.sdk import dict_to_pretty_json
from ide.utils import generate_half_uuid
from utils.keen_helper import send_keen_event

@task(acks_late=True)
def import_gist(user_id, gist_id):
    user = User.objects.get(pk=user_id)
    g = github.Github()

    try:
        gist = g.get_gist(gist_id)
    except github.UnknownObjectException as e:
        send_keen_event('cloudpebble', 'cloudpebble_gist_not_found', user=user, data={'gist_id': gist_id})
        raise Exception("Couldn't find gist to import.")

    files = gist.files
    default_name = gist.description or 'Sample project'

    if 'appinfo.json' in files:
        settings = json.loads(files['appinfo.json'].content)
    else:
        settings = {}

    project_settings = {
        'name': settings.get('longName', default_name),
        'owner': user,
        'sdk_version': 2,
        'app_uuid':  generate_half_uuid(),
        'app_short_name': settings.get('shortName', default_name),
        'app_long_name': settings.get('longName', default_name),
        'app_company_name': settings.get('companyName', user.username),
        'app_version_code': 1,
        'app_version_label': settings.get('versionLabel', '1.0'),
        'app_is_watchface': settings.get('watchapp', {}).get('watchface', False),
        'app_capabilities': ','.join(settings.get('capabilities', [])),
        'app_keys': dict_to_pretty_json(settings.get('appKeys', {}))
    }

    with transaction.commit_on_success():
        project = Project.objects.create(**project_settings)

        for filename in gist.files:
            if filename.endswith('.c') or filename.endswith('.h') or filename == 'pebble-js-app.js':
                # Because gists can't have subdirectories.
                if filename == 'pebble-js-app.js':
                    cp_filename = 'js/pebble-js-app.js'
                else:
                    cp_filename = filename
                source_file = SourceFile.objects.create(project=project, file_name=cp_filename)
                source_file.save_file(gist.files[filename].content)


    send_keen_event('cloudpebble', 'cloudpebble_gist_import', project=project, data={'gist_id': gist_id})
    return project.id
