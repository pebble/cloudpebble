import requests
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe

from orchestrator_proxy.utils.uuid_map import lookup_uuid
from orchestrator_proxy.utils.auth import check_token

@require_safe
@csrf_exempt
def get_log(request, uuid):
    if not check_token(request.GET.get('token', None)):
        return HttpResponse(status=401)
    task_id = lookup_uuid(uuid)
    result = requests.get("{}/tasks/{}/output".format(settings.ORCHESTRATOR_URL, task_id, cert=settings.PBLTEST_CERT_LOCATION))
    result.raise_for_status()
    return HttpResponse(result.iter_content(100), content_type=result.headers['content-type'])
