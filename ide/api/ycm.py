import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from ide.api import json_response, json_failure
from ide.models.project import Project
import requests
import random

__author__ = 'katharine'

@login_required
@require_POST
def init_autocomplete(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_files = project.source_files.all()
    resource_files = project.resources.all()
    file_contents = {}
    for f in source_files:
        file_contents[f.project_path] = f.get_contents()

    resource_ids = []
    count = 1
    for f in resource_files:
        for identifier in f.identifiers.all():
            if f.kind == 'png-trans':
                resource_ids.extend([
                    '#define RESOURCE_ID_%s_BLACK %d' % (identifier.resource_id, count),
                    '#define RESOURCE_ID_%s_WHITE %d' % (identifier.resource_id, count+1)
                ])
                count += 2
            else:
                resource_ids.append('#define RESOURCE_ID_%s %d' % (identifier.resource_id, count))
                count += 1
    file_contents['build/src/resource_ids.auto.h'] = '\n'.join(resource_ids) + "\n"

    request = {'files': file_contents, 'platforms': request.POST.get('platforms', 'aplite').split(',')}
    # Let's go!
    return _spin_up_server(request)


def _choose_ycm_server():
    return random.choice(settings.YCM_URLS)


def _spin_up_server(request):
    servers = set(settings.YCM_URLS)
    print request
    while len(servers) > 0:
        server = random.choice(list(servers))
        servers.remove(server)
        try:
            result = requests.post('%sspinup' % server, json.dumps(request), headers={'Content-Type': 'application/json'}, verify=settings.COMPLETION_CERTS)
            if result.ok:
                response = result.json()
                if response['success']:
                    return json_response({'uuid': response['uuid'], 'server': server})
        except (requests.RequestException, ValueError):
            import traceback
            traceback.print_exc()
        print "Server %s failed; trying another." % server
    # If we get out of here, something went wrong.
    return json_failure({'success': False, 'error': 'No servers'})
