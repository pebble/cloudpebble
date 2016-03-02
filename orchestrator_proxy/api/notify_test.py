from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from orchestrator_proxy.utils.uuid_map import lookup_uuid, is_notified, set_notified

@require_POST
@csrf_exempt
def notify_test(request, private_uuid):
    """ Fetches test result info from Orchestrator, with whitelisted keys and rewritten artefact urls """
    job_id = lookup_uuid(private_uuid, kind='private')
    if is_notified(job_id):
        raise HttpResponse(status=400)
    set_notified(job_id, True)
    return HttpResponse(status=200)
