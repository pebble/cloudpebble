from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from ide.api import json_response
from ide.tasks.archive import export_user_projects
from utils.keen_helper import send_keen_event

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

    # For now we just include what's new in this handy array...
    new_things = [
        ["You will now be alerted to new features on your first visit to the site after they're added. For instance, this one."],
    ]

    user_settings = request.user.settings
    what = user_settings.whats_new
    if what < len(new_things):
        user_settings.whats_new = len(new_things)
        user_settings.save()
        return json_response({'new': new_things[what:][::-1]})
    else:
        return json_response({'new': []})

