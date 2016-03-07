from ide.tasks.td_task import td_add_events

__author__ = 'katharine'

import collections
import json
import time

from django.conf import settings


# WARNING: Keen does not appear to respect the filters on scoped write keys.
# Don't use this function.
def generate_scoped_key(user):
    uid = user.social_auth.get(provider='pebble').uid
    filters = [{
        'property_name': 'identity.user',
        'operator': 'eq',
        'property_value': uid
    }]

    return keen.scoped_keys.encrypt(settings.KEEN_API_KEY, {'filters': filters, 'allowed_operations': ['write']})


def _flatten(d, parent_key=''):
    items = []
    for k, v in d.iteritems():
        new_key = parent_key + '_0_' + k if parent_key else k
        if isinstance(v, collections.MutableMapping):
            items.extend(_flatten(v, new_key).iteritems())
        else:
            items.append((new_key, v))
    return dict(items)


def send_td_event(event, data=None, request=None, project=None, user=None):
    if not settings.TD_ENABLED:
        return

    data = data.copy() if data is not None else {}
    data['event'] = event
    data['cloudpebble'] = {}

    if user is None:
        if request is not None and request.user.is_authenticated():
            user = request.user
        elif project is not None:
            user = project.owner

    if user is not None:
        data['identity'] = {'cloudpebble_uid': user.id}
        try:
            data['identity']['user'] = user.social_auth.get(provider='pebble').uid
        except:
            pass

    if project is not None:
        data['cloudpebble']['project'] = {
            'id': project.id,
            'name': project.name,
            'uuid': project.app_uuid,
            'app_name': project.app_long_name,
            'is_watchface': project.app_is_watchface,
            'is_hidden': project.app_is_hidden,
            'is_shown_on_communication': project.app_is_shown_on_communication,
            'jshint': project.app_jshint,
            'type': project.project_type,
            'sdk': project.sdk_version,
        }

    data['platform'] = 'cloudpebble'
    if request is not None:
        data['web'] = {
            'referrer': request.META.get('HTTP_REFERER'),
            'user_agent': request.META.get('HTTP_USER_AGENT'),
            'path': request.path,
            'ip': request.META.get('HTTP_X_FORWARDED_FOR', request.META['REMOTE_ADDR']).split(',')[0],
            'url': request.build_absolute_uri(),
        }

    flat = _flatten(data)
    td_request = {"json": json.dumps(flat), "time": int(time.time())}

    # keen.add_events(keen_request) # probably don't want to block while this processes...
    td_add_events.delay(td_request)
