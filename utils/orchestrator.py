import requests
from django.conf import settings


def submit_test(bundle_url, job_name=None, notify_url=None, requestor="cloudpebble@pebble.com"):
    """ Submit a test to be run on Orchestrator
    :param bundle_url: URL at which Orchestrator can download the test bundle
    :param job_name: Optional, Name of the job in orchestrator
    :param notify_url: Optional, URL which Orchestrator should ping when it the test is complete
    :param requestor: Email address of the user requesting the test
    :return:
    """
    # Build the orchestrator job request
    data = {
        "requestor": requestor,
        "tests": [bundle_url],
        "sw_ver": {
            "sdk": "master",
            "firmware": "LKGR"
        },
        "devices": {
            "firmware": "qemu_snowy_bb2"
        }
    }
    if notify_url:
        data['notify'] = {'http': notify_url}
    if job_name:
        data['name'] = job_name
    # Submit the orchestrator job request
    submit_url = "%s/api/jobs/submit" % settings.ORCHESTRATOR_URL
    result = requests.post(submit_url, json=data)
    result.raise_for_status()
    return result


def upload_test(f, filename="test_archive.test"):
    """ Upload a file to orchestrator
    :param f: (Open) file to upload
    :param filename: Name of file reported to orchestrator
    :return: URL to download the file from orchestrator
    """
    upload_api = "%s/api/upload" % settings.ORCHESTRATOR_URL
    result = requests.post(upload_api, files=[("file", (filename, f))])
    result.raise_for_status()
    return "%s/api/download/test_bundle/%s" % (settings.ORCHESTRATOR_URL, result.json()['filename'])


def get_job_info(job_id):
    """ Get info about a particular job from orchestrator
    :param job_id: Orchestrator ID for the job
    :return: Dictionary of test result information
    """
    info_api = "%s/api/jobs/%s" % (settings.ORCHESTRATOR_URL, job_id)
    return requests.get(info_api).json()
