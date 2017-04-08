__author__ = 'katharine'

import json
import requests
import random
import urlparse
import string
import logging

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.http import require_POST
from django.utils.translation import ugettext as _

from utils.redis_helper import redis_client
from utils.jsonview import json_view, InternalServerError

logger = logging.getLogger(__name__)


@login_required
@require_POST
@json_view
def launch_emulator(request):
    user_id = request.user.id
    platform = request.POST['platform']

    oauth = request.POST['token']
    tz_offset = request.POST['tz_offset']
    versions = {
        'aplite': '3.0',
        'basalt': '3.0',
        'chalk': '3.0',
        'diorite': '3.0',
        'emery': '3.0',
    }
    version = versions[platform]
    redis_key = 'qemu-user-%s-%s' % (user_id, platform)
    qemu_instance = redis_client.get(redis_key)
    if qemu_instance is not None:
        qemu_instance = json.loads(qemu_instance)
        try:
            response = requests.post(qemu_instance['ping_url'], timeout=2)
            response.raise_for_status()
            response = response.json()
        except (requests.RequestException, ValueError) as e:
            logger.info("couldn't fetch old instance: %s", e)
        else:
            if response.get('alive', False):
                return qemu_instance
            else:
                logger.info("old instance is dead.")

    token = _generate_token()
    servers = set(settings.QEMU_URLS)
    while len(servers) > 0:
        server = random.choice(list(servers))
        servers.remove(server)
        try:
            result = requests.post(server + 'qemu/launch',
                                   data={'token': token,
                                         'platform': platform,
                                         'version': version,
                                         'oauth': oauth,
                                         'tz_offset': tz_offset},
                                   headers={'Authorization': settings.QEMU_LAUNCH_AUTH_HEADER},
                                   timeout=settings.QEMU_LAUNCH_TIMEOUT)
            result.raise_for_status()
            response = result.json()
            url = urlparse.urlsplit(server)
            response['host'] = url.hostname
            response['secure'] = (url.scheme == 'https')
            response['api_port'] = url.port or (443 if url.scheme == 'https' else 80)
            response['ping_url'] = '%sqemu/%s/ping' % (server, response['uuid'])
            response['kill_url'] = '%sqemu/%s/kill' % (server, response['uuid'])
            response['token'] = token
            redis_client.set(redis_key, json.dumps(response))
            return response
        except requests.HTTPError as e:
            logger.warning("Got HTTP error from QEMU launch. Content:\n%s", e.response.text)
        except (requests.RequestException, ValueError) as e:
            logger.error("Error launching qemu: %s", e)
    raise InternalServerError(_("Unable to create emulator instance."))


@login_required
@require_POST
@json_view
def generate_phone_token(request, emulator_id):
    phone_token = random.randint(100000, 999999)
    token = request.POST['token']
    url = request.POST['url']
    redis_key = 'qemu-phone-token-%s' % phone_token
    redis_client.set(redis_key, json.dumps({'uuid': emulator_id, 'token': token, 'url': url}), ex=300)
    return {'token': phone_token}


def handle_phone_token(request, token):
    redis_key = 'qemu-phone-token-%s' % token
    qemu = redis_client.get(redis_key)
    if qemu is not None:
        qemu = json.loads(qemu)
        return render(request, "ide/qemu-sensors.html", {
            'url': qemu['url'],
            'token': qemu['token'],
        })
    else:
        return render(request, "ide/qemu-enter-token.html", {
            'failed': True
        })


def _generate_token():
    rng = random.SystemRandom()
    valid = string.ascii_letters + string.digits + string.punctuation
    return ''.join(rng.choice(valid) for i in xrange(30))
