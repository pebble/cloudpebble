import json
import logging
import random

import requests
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST
from urlparse import urlparse

from ide.models.project import Project
from utils.jsonview import json_view

__author__ = 'katharine'

logger = logging.getLogger(__name__)


@login_required
@require_POST
@json_view
def init_autocomplete(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_files = project.source_files.all()

    file_contents = {}
    for f in source_files:
        file_contents[f.project_path] = f.get_contents()

    identifiers = [(f.kind, i.resource_id) for f in project.resources.all() for i in f.identifiers.all()]

    appkey_names = [k for k, v in project.get_parsed_appkeys()]

    request = {
        'files': file_contents,
        'platforms': request.POST.get('platforms', 'aplite').split(','),
        'sdk': request.POST.get('sdk', '2'),
        'messagekeys': appkey_names,
        'resources': identifiers,
        'dependencies': project.get_dependencies()
    }
    # Let's go!
    return _spin_up_server(request)


def _choose_ycm_server():
    return random.choice(settings.YCM_URLS)


def _spin_up_server(request):
    servers = set(settings.YCM_URLS)
    while len(servers) > 0:
        server = random.choice(list(servers))
        servers.remove(server)
        try:
            result = requests.post('%sspinup' % server, json.dumps(request), headers={'Content-Type': 'application/json'})
            if result.ok:
                response = result.json()
                if response['success']:
                    secure = response['secure']
                    scheme = "wss" if secure else "ws"
                    ws_server = urlparse(server)._replace(scheme=scheme).geturl()
                    return {
                        'uuid': response['uuid'],
                        'server': ws_server,
                        'secure': secure,
                        'libraries': response.get('libraries', {}),
                        'npm_error': response.get('npm_error', None)
                    }

        except (requests.RequestException, ValueError):
            import traceback
            traceback.print_exc()
        logger.warning("Server %s failed; trying another.", server)
    # If we get out of here, something went wrong.
    raise Exception(_('No Servers'))
