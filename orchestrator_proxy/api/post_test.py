from cStringIO import StringIO

from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.urlresolvers import reverse
from django.http import HttpResponse
from uuid import uuid4
from ide.api import json_response
from orchestrator_proxy.utils import uuid_map
from utils import orchestrator
from utils.monkeyscript_helpers import frame_tests_in_bundle
from orchestrator_proxy.utils.auth import check_token


def post_archive(archive_file, notify_url_builder=None):
    outfile = StringIO()
    frame_tests_in_bundle(archive_file, outfile)
    outfile.seek(0, 0)
    # Upload the bundle to orchestrator and get the URL of the bundle
    bundle_url = orchestrator.upload_test(outfile)
    private_uuid = str(uuid4())
    notify_url = notify_url_builder(private_uuid) if callable(notify_url_builder) else None
    # Submit a new test job pointing to the uploaded test bundle
    # TODO: come up with an orchestrator naming scheme for 3rd party tests
    result = orchestrator.submit_test(bundle_url, job_name="3rd party test", notify_url=notify_url).json()
    job_id = result['job_id']
    uuid_map.make_uuid(job_id, uuid=private_uuid, kind='private')
    public_uuid = uuid_map.make_uuid(job_id)
    uuid_map.set_notified(job_id, False)
    result['job_id'] = public_uuid
    return result


@require_POST
@csrf_exempt
def post_test(request):
    """ Process a test bundle uploaded from the SDK and send it to orchestrator """
    # The API receives a test bundle.
    # Add framing to the tests in a new zip archive
    if not check_token(request.GET.get('token', None)):
        return HttpResponse(status=401)
    infile = request.FILES['archive']

    def build_notify_url(uuid):
        return request.build_absolute_uri(reverse('orchestrator:notify_test', args=[uuid]))

    result = post_archive(infile, build_notify_url)

    return json_response(result, success=None)
