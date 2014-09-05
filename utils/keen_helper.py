from ide.tasks.keen_task import keen_add_events

__author__ = 'katharine'

from django.conf import settings

import keen
import keen.scoped_keys


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


def send_keen_event(collections, event, data=None, request=None, project=None, user=None):
    if not settings.KEEN_ENABLED:
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
            'jshint': project.app_jshint,
            'type': project.project_type,
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

    keen_request = {"events": [data]}

    if not hasattr(collections, '__iter__'):
        collections = [collections]

    for collection in collections:
        keen_request[collection] = [data]

    # keen.add_events(keen_request) # probably don't want to block while this processes...
    keen_add_events.delay(keen_request)
