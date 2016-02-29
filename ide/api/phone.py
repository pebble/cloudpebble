import uuid
import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe, require_POST
from django.utils.translation import ugettext as _

import requests
from ide.api import json_failure, json_response
from utils.redis_helper import redis_client


@login_required
@require_safe
def list_phones(request):
    user_key = request.user.social_auth.get(provider='pebble').extra_data['access_token']

    response = requests.get(
        '{0}/api/v1/me.json'.format(settings.SOCIAL_AUTH_PEBBLE_ROOT_URL),
        headers={'Authorization': 'Bearer {0}'.format(user_key)},
        params={'client_id': settings.SOCIAL_AUTH_PEBBLE_KEY})

    if response.status_code != 200:
        return json_failure(response.reason)
    else:
        devices = response.json()['devices']
        return json_response({'devices': devices})


@login_required
@require_POST
def ping_phone(request):
    user_id = request.user.social_auth.get(provider='pebble').uid
    device = request.POST['device']

    check_token = uuid.uuid4().hex

    requests.post(
        '{0}/api/v1/users/{1}/devices/{2}/push'.format(settings.SOCIAL_AUTH_PEBBLE_ROOT_URL, user_id, device),
        params={
            'admin_token': settings.PEBBLE_AUTH_ADMIN_TOKEN,
            # 'silent': True,
            'message': _("Tap to enable developer mode and install apps from CloudPebble."),
            'custom': json.dumps({
                'action': 'sdk_connect',
                'token': check_token,
                'url': '{0}/ide/update_phone'.format(settings.PUBLIC_URL)
            })
        }
    )

    return json_response({'token': check_token})


@login_required
@require_safe
def check_phone(request, request_id):
    ip = redis_client.get('phone-ip-{0}'.format(request_id))
    if ip is None:
        return json_response({'pending': True})
    else:
        return json_response({'pending': False, 'response': json.loads(ip)})


@require_POST
@csrf_exempt
def update_phone(request):
    data = json.loads(request.body)
    redis_client.set('phone-ip-{0}'.format(data['token']), request.body, ex=120)
    return json_response({})
