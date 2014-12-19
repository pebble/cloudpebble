__author__ = 'katharine'

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
import urlparse


@login_required
@require_POST
def launch_emulator(request):
    # TODO: limit one per user
    token = request.POST['token']
    servers = set(settings.QEMU_URLS)
    while len(servers) > 0:
        server = random.choice(list(servers))
        servers.remove(server)
        try:
            result = requests.post(server + 'launch', data={'token': token})
            result.raise_for_status()
            response = result.json()
            response['host'] = urlparse.urlsplit(server).hostname
            return json_response(response)
        except (requests.RequestException, ValueError):
            pass
    return json_failure("No capacity available.")
