from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from ide.api import json_response
from ide.tasks.archive import export_user_projects
from utils.td_helper import send_td_event
from ide.utils.whatsnew import get_new_things

__author__ = 'katharine'


@login_required
@require_POST
def transition_accept(request):
    user_settings = request.user.settings
    user_settings.accepted_terms = True
    user_settings.save()
    send_td_event('cloudpebble_ownership_transition_accepted', request=request)
    return json_response({})


@login_required
@require_POST
def transition_export(request):
    task = export_user_projects.delay(request.user.id)
    return json_response({"task_id": task.task_id})


@login_required
@require_POST
def transition_delete(request):
    send_td_event('cloudpebble_ownership_transition_declined', request=request)
    request.user.delete()
    return json_response({})

def whats_new(request):
    # Unauthenticated users never have anything new.
    if not request.user.is_authenticated():
        return json_response({'new': []})

    return json_response({'new': get_new_things(request.user)})
