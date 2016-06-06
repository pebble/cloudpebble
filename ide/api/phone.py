import uuid
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.utils import simplejson as json, simplejson
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe, require_POST
from django.utils.translation import ugettext as _

import requests
from utils.redis_helper import redis_client
from utils.jsonview import json_view, BadRequest


@login_required
@require_safe
@json_view
def list_phones(request):
    user_key = request.user.social_auth.get(provider='pebble').extra_data['access_token']

    response = requests.get(
        '{0}/api/v1/me.json'.format(settings.SOCIAL_AUTH_PEBBLE_ROOT_URL),
        headers={'Authorization': 'Bearer {0}'.format(user_key)},
        params={'client_id': settings.SOCIAL_AUTH_PEBBLE_KEY})

    if response.status_code != 200:
        if 400 <= response.status_code < 500:
            raise BadRequest(response.reason)
        else:
            raise Exception(response.reason)
    else:
        devices = response.json()['devices']
        return {'devices': devices}


@login_required
@require_POST
@json_view
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

    return {'token': check_token}


@login_required
@require_safe
@json_view
def check_phone(request, request_id):
    ip = redis_client.get('phone-ip-{0}'.format(request_id))
    if ip is None:
        return {'pending': True}
    else:
        return {'pending': False, 'response': json.loads(ip)}


@require_POST
@csrf_exempt
@json_view
def update_phone(request):
    data = json.loads(request.body)
    redis_client.set('phone-ip-{0}'.format(data['token']), request.body, ex=120)