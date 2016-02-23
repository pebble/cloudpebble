import requests
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe

from orchestrator_proxy.utils.uuid_map import lookup_uuid


@require_safe
@csrf_exempt
def get_log(request, uuid):
    """ Fetches test result info from Orchestrator, with whitelisted keys and rewritten artefact urls """
    log_id = lookup_uuid(uuid, kind='log')
    result = requests.get("{}/tasks/{}/output".format(settings.ORCHESTRATOR_URL, log_id))
    result.raise_for_status()
    return HttpResponse(result.iter_content(100), content_type=result.headers['content-type'])
