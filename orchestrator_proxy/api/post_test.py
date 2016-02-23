from cStringIO import StringIO

from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ide.api import json_response
from orchestrator_proxy.utils import uuid_map
from utils import orchestrator
from utils.test_bundle_helpers import frame_tests_in_bundle


def post_archive(archive_file):
    outfile = StringIO()
    frame_tests_in_bundle(archive_file, outfile)
    outfile.seek(0, 0)
    # Upload the bundle to orchestrator and get the URL of the bundle
    bundle_url = orchestrator.upload_test(outfile)
    # Submit a new test job pointing to the uploaded test bundle
    # TODO: come up with an orchestrator naming scheme for 3rd party tests
    result = orchestrator.submit_test(bundle_url, job_name="3rd party test").json()
    uuid = uuid_map.make_uuid(result['job_id'])
    result['job_id'] = uuid
    return result


@require_POST
@csrf_exempt
def post_test(request):
    """ Process a test bundle uploaded from the SDK and send it to orchestrator """
    # The API receives a test bundle.
    # Add framing to the tests in a new zip archive
    infile = request.FILES['archive']
    result = post_archive(infile)
    return json_response(result)


def local_test():
    with open('archive.zip', 'r') as infile, open('out_archive.zip', 'w') as outfile:
        frame_tests_in_bundle(infile, outfile)


if __name__ == '__main__':
    local_test()
