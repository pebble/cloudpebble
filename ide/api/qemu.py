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
import string
from utils.redis_helper import redis_client


@login_required
@require_POST
def launch_emulator(request):
    user_id = request.user.id
    redis_key = 'qemu-user-%s' % user_id
    qemu_instance = redis_client.get(redis_key)
    if qemu_instance is not None:
        qemu_instance = json.loads(qemu_instance)
        try:
            response = requests.post(qemu_instance['ping_url'], timeout=2, verify=settings.COMPLETION_CERTS)
            response.raise_for_status()
            response = response.json()
        except (requests.RequestException, ValueError) as e:
            print "couldn't fetch old instance: %s" % e
            pass
        else:
            if response.get('alive', False):
                return json_response(qemu_instance)
            else:
                print "old instance is dead."


    token = _generate_token()
    servers = set(settings.QEMU_URLS)
    while len(servers) > 0:
        server = random.choice(list(servers))
        servers.remove(server)
        try:
            result = requests.post(server + 'qemu/launch',
                                   data={'token': token},
                                   headers={'Authorization': settings.QEMU_LAUNCH_AUTH_HEADER},
                                   timeout=15,
                                   verify=settings.COMPLETION_CERTS)
            result.raise_for_status()
            response = result.json()
            url = urlparse.urlsplit(server)
            response['host'] = url.hostname
            response['secure'] = (url.scheme == 'https')
            response['api_port'] = url.port
            response['ping_url'] = '%sqemu/%s/ping' % (server, response['uuid'])
            response['kill_url'] = '%sqemu/%s/kill' % (server, response['uuid'])
            response['token'] = token
            redis_client.set(redis_key, json.dumps(response))
            return json_response(response)
        except requests.HTTPError as e:
            print e.response.text
        except (requests.RequestException, ValueError) as e:
            print e
            pass
    return json_failure("No capacity available.")


def _generate_token():
    rng = random.SystemRandom()
    valid = string.ascii_letters + string.digits + string.punctuation
    return ''.join(rng.choice(valid) for i in xrange(30))
