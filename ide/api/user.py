from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from ide.api import json_response
from ide.tasks.archive import export_user_projects
from utils.keen_helper import send_keen_event
from ide.utils.whatsnew import get_new_things
from utils.redis_helper import redis_client
from django.conf import settings

__author__ = 'katharine'


@login_required
@require_POST
def transition_accept(request):
    user_settings = request.user.settings
    user_settings.accepted_terms = True
    user_settings.save()
    send_keen_event('cloudpebble', 'cloudpebble_ownership_transition_accepted', request=request)
    return json_response({})


@login_required
@require_POST
def transition_export(request):
    task = export_user_projects.delay(request.user.id)
    return json_response({"task_id": task.task_id})


@login_required
@require_POST
def transition_delete(request):
    send_keen_event('cloudpebble', 'cloudpebble_ownership_transition_declined', request=request)
    request.user.delete()
    return json_response({})

def whats_new(request):
    # Unauthenticated users never have anything new.
    if not request.user.is_authenticated():
        return json_response({'new': []})

    try:
        user_id = request.user.social_auth.get(provider='pebble').uid
        if user_id in settings.FREE_WATCH_USERS:
            if not redis_client.exists("no-free-snowy-%s" % user_id):
                return json_response({'free_snowy': settings.FREE_WATCH_URL, 'new': []})
    except:
        pass

    return json_response({'new': get_new_things(request.user)})

@login_required
@require_POST
def hide_snowy_offer(request):
    user_id = request.user.social_auth.get(provider='pebble').uid
    redis_client.set("no-free-snowy-%s" % user_id, "1")
    return json_response({})
