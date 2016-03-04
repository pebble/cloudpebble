import requests
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe
from django.http import HttpResponse

@require_safe
@csrf_exempt
def get_artefact(request, filename):
    """ This API call proxies test artefact downloads to Orchestrator. """

    result = requests.get("%s/api/download/media/%s" % (settings.ORCHESTRATOR_URL, filename))
    result.raise_for_status()
    return HttpResponse(result.iter_content(100), content_type=result.headers['content-type'])
