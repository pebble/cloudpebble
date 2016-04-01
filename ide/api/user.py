from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from ide.tasks.archive import export_user_projects
from utils.td_helper import send_td_event
from utils.jsonview import json_view
from ide.utils.whatsnew import get_new_things

__author__ = 'katharine'


@login_required
@require_POST
@json_view
def transition_accept(request):
    user_settings = request.user.settings
    user_settings.accepted_terms = True
    user_settings.save()
    send_td_event('cloudpebble_ownership_transition_accepted', request=request)


@login_required
@require_POST
@json_view
def transition_export(request):
    task = export_user_projects.delay(request.user.id)
    return {"task_id": task.task_id}


@login_required
@require_POST
@json_view
def transition_delete(request):
    send_td_event('cloudpebble_ownership_transition_declined', request=request)
    request.user.delete()


@json_view
def whats_new(request):
    # Unauthenticated users never have anything new.
    if not request.user.is_authenticated():
        return {'new': []}

    return {'new': get_new_things(request.user)}
