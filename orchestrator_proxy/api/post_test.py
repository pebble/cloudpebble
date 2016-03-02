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


def post_archive(archive_file, notify_url_builder=None, email="cloudpebble@pebble.com"):
    # Add test framing to the tests in the bundle file
    outfile = StringIO()
    frame_tests_in_bundle(archive_file, outfile)
    outfile.seek(0, 0)
    # Upload the bundle to orchestrator and get the URL of the bundle
    bundle_url = orchestrator.upload_test(outfile)

    # Build the notification callback URL for orchestrator, which uses a separate UUID to the user
    private_uuid = str(uuid4())
    notify_url = notify_url_builder(private_uuid) if callable(notify_url_builder) else None

    # Submit a new test job pointing to the uploaded test bundle
    job_name = "3rd Party Test for {}".format(email)
    result = orchestrator.submit_test(bundle_url, job_name=job_name, notify_url=notify_url).json()

    # Link the new job ID to UUIDs for the user and for the Orchestrator callback
    job_id = result['job_id']
    uuid_map.make_uuid(job_id, uuid=private_uuid, kind='private')
    public_uuid = uuid_map.make_uuid(job_id)

    # Set the job-comleted flag to false
    uuid_map.set_notified(job_id, False)

    # Return the user-facing UUID instead of Orchestrator's job ID.
    return public_uuid


@require_POST
@csrf_exempt
def post_test(request):
    """ Process a test bundle uploaded from the SDK and send it to orchestrator """
    # The API receives a test bundle.
    # Add framing to the tests in a new zip archive
    user_email = check_token(request.GET.get('token', None))
    if user_email is False:
        return HttpResponse(status=401)
    infile = request.FILES['archive']

    def build_notify_url(uuid):
        return request.build_absolute_uri(reverse('orchestrator:notify_test', args=[uuid]))

    uuid = post_archive(infile, notify_url_builder=build_notify_url, email=user_email)

    return json_response({'job_id': uuid}, success=None)
