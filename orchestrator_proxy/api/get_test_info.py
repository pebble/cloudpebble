import os

from django.core.urlresolvers import reverse, NoReverseMatch
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe
from django.http import Http404
from django.core.exceptions import PermissionDenied

from orchestrator_proxy.utils import uuid_map
from orchestrator_proxy.utils.auth import check_token
from utils import orchestrator
from utils.filter_dict import filter_dict, TransformValue, TransformKeyAndValue
from utils.jsonview import json_view


@require_safe
@csrf_exempt
@json_view(include_success=False)
def get_test_info(request, uuid):
    """ Fetches test result info from Orchestrator and returns it in a form suitable for 3rd party developers """
    if not check_token(request.GET.get('token', None)):
        raise PermissionDenied
    try:
        job_id = uuid_map.lookup_uuid(uuid)
    except KeyError:
        raise Http404("Job not found")

    if uuid_map.is_notified(job_id):
        info = orchestrator.get_job_info(job_id)
        processor = TestInfoProcessor(request.build_absolute_uri)
        filtered_info = processor.process(info, uuid)
        return filtered_info
    else:
        return {
            'status': 'running'
        }


class TestInfoProcessor(object):
    def __init__(self, absolute_uri_builder):
        self.build_absolute_uri = absolute_uri_builder

    def process_artefacts(self, artefacts):
        """ Take a list of Orchestrator artefacts and rewrite the download URLs to point to the CloudPebble's artefact proxy """
        out = []
        for a in artefacts:
            orig = a[0]
            new = a[1]
            try:
                url = reverse('orchestrator:get_artefact', args=[os.path.basename(new)])
            except NoReverseMatch:
                continue
            if callable(self.build_absolute_uri):
                url = self.build_absolute_uri(url)
            out.append([orig, url])
        return out

    def make_test_url(self, test_id):
        test_uuid = uuid_map.make_uuid(test_id, unique=True)
        return self.build_absolute_uri(reverse('orchestrator:get_log', args=[test_uuid]))

    def process(self, info, new_id):
        """ Converts test info from Orchestrator to a form suitable for 3rd party developers
        :param info: Test info dict fetched from Orchestrator
        :param new_id: ID to assign to the output
        :param build_absolute_uri: A function which builds an absolute URL for CloudPebble given a local URL
        """
        get_platform = TransformKeyAndValue(lambda configs: ('platform', orchestrator.platform_for_device(configs['firmware']['device_type'])))
        process_artefacts = TransformValue(self.process_artefacts)

        # Whitelist the keys and rewrite artefact URLs
        whitelist = {
            "status": True,
            "submitted_time": True,
            "tests": {
                True: {
                    "status": True,
                    "submitted_time": True,
                    "result": {
                        "duration": True,
                        "ret": True,
                        "artifacts": process_artefacts
                    }
                }
            },
            "sw_configs": get_platform
        }
        filtered_info = filter_dict(info, whitelist)

        # Add new values for log URLs
        for test_name, test_info in info['tests'].iteritems():
            # The test should have a log if the test result has a return value
            if 'ret' in test_info['result']:
                filtered_info['tests'][test_name]['result']['log'] = self.make_test_url(test_info['_id'])

        filtered_info['id'] = new_id
        return filtered_info
