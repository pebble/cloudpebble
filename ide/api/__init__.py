import urllib2
import json
from celery.result import AsyncResult
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST, require_safe
from ide.models.project import Project

__author__ = 'katharine'


def json_response(response=None):
    if response is None:
        response = {}

    response["success"] = True
    return HttpResponse(json.dumps(response), content_type="application/json")


def json_failure(error):
    return HttpResponse(json.dumps({"success": False, "error": error}), content_type="application/json")


@login_required
@require_POST
def proxy_keen(request, project_id):
    from utils.td_helper import send_td_event
    project = get_object_or_404(Project, pk=project_id)

    acceptable_events = {
        'app_install_succeeded',
        'websocket_connection_failed',
        'app_install_failed',
        'app_log_view',
        'app_log_clear',
        'app_log_download',
        'app_logged_crash',
        'sdk_screenshot_success',
        'sdk_screenshot_failed',
        'cloudpebble_created_ui_layout',
        'cloudpebble_ib_displayed',
        'cloudpebble_ib_created_layer',
        'cloudpebble_android_beta_modal',
        'cloudpebble_android_beta_download',
        'qemu_launched',
        'cloudpebble_timeline_displayed',
        'sdk_pin_inserted',
        'sdk_pin_deleted',
        'cloudpebble_fuzzyprompt_action'
    }

    event = request.POST['event']
    if event not in acceptable_events:
        return json_failure("nope.")

    data = {}
    if 'data' in request.POST:
        data['data'] = json.loads(request.POST['data'])

    if 'device' in request.POST:
        data['device'] = json.loads(request.POST['device'])

    collections = ['cloudpebble', 'sdk']
    if 'collections' in request.POST:
        collections = list(set(collections) & set(json.loads(request.POST['collections'])))

    if len(data.items()) == 0:
        data = None

    send_td_event(event, data=data, request=request, project=project)
    return json_response({})


@require_safe
def check_task(request, task_id):
    result = AsyncResult(task_id)
    return json_response({
        'state': {
            'status': result.status,
            'result': result.result if result.status == 'SUCCESS' else str(result.result)
        }
    })


@require_POST
def get_shortlink(request):
    from utils.td_helper import send_td_event
    url = request.POST['url']
    try:
        r = urllib2.Request('http://api.small.cat/entries', json.dumps({'value': url, 'duration': 60}), headers={'Content-Type': 'application/json'})
        response = json.loads(urllib2.urlopen(r).read())
    except urllib2.URLError as e:
        return json_failure(str(e))
    else:
        send_td_event('cloudpebble_generate_shortlink', data={
            'data': {'short_url': response['url']}
        }, request=request)
        return json_response({'url': response['url']})

def heartbeat(request):
    return json_response({})
