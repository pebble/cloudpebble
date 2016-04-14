import requests
from django.conf import settings

_platform_firmware_map = {
    'aplite': 'qemu_bb2',
    'basalt': 'qemu_snowy_bb2',
    'chalk': 'qemu_spalding_bb2'
}
_firmware_platform_map = {v: k for k, v in _platform_firmware_map.items()}


def device_for_platform(platform):
    """ :param platform: a platform name e.g. 'aplite'
    :return: The device name used on Orchestrator for the platform e.g. 'qemu_bb2'
    """
    return _platform_firmware_map[platform]


def platform_for_device(device):
    """ :param device: a device name e.g. 'qemu_bb2'
    :return: The platform name corresponding to the device name e.g. 'aplite'
    """
    return _firmware_platform_map[device]


def submit_test(bundle_url, platform, job_name=None, notify_url=None, requestor="cloudpebble@pebble.com"):
    """ Submit a test to be run on Orchestrator
    :param bundle_url: URL at which Orchestrator can download the test bundle
    :param platform: "aplite", "basalt" or "chalk"
    :param job_name: Optional, Name of the job in orchestrator
    :param notify_url: Optional, URL which Orchestrator should ping when it the test is complete
    :param requestor: Email address of the user requesting the test
    :return:
    """
    # Build the orchestrator job request
    # TODO: define this somewhere else?

    try:
        platform = device_for_platform(platform)
    except KeyError:
        raise KeyError('Invalid platform specified. Choices are {}'.format(",".join("'{}'".format(p) for p in _platform_firmware_map.keys())))

    data = {
        "requestor": requestor,
        "tests": [bundle_url],
        "sw_ver": {
            "sdk": "LKGR",
            "firmware": "LKGR"
        },
        "devices": {
            "firmware": platform
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
    result = requests.get(info_api)
    result.raise_for_status()
    return result.json()


def get_job_log(task_id):
    """ Get the logs for a single orchestrator task
    :param task_id: Orchestrator ID for the task
    :return: String containing the log
    """
    log_url = '%s/tasks/%s/output' % (settings.ORCHESTRATOR_URL, task_id)
    return requests.get(log_url).text
