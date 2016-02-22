import requests
import zipfile
import os
import json
from cStringIO import StringIO

orch_url = 'http://orchestrator.hq.getpebble.com'


def submit_test(bundle_url, notify_url_builder, orch_name, session):
    # Build the orchestrator job request
    # TODO: custom configuration
    data = {
        "requestor": "cloudpebble@pebble.com",
        "tests": [bundle_url],
        "notify": {
            "http": notify_url_builder(session)
        },
        "sw_ver": {
            "sdk": "master",
            "firmware": "LKGR"
        },
        "devices": {
            "firmware": "qemu_snowy_bb2"
        },
        "name": orch_name
    }
    # Submit the orchestrator job request
    submit_url = "%s/api/jobs/submit" % orch_url
    result = requests.post(submit_url, json=data)
    result.raise_for_status()


def upload_test(f):
    upload_api = "%s/api/upload" % orch_url
    result = requests.post(upload_api, files=[("file", ("test_archive.test", f))])
    result.raise_for_status()
    # Get the download link
    return "%s/api/download/test_bundle/%s" % (orch_url, result.json()['filename'])


def frame_test_file(f, test_name, app_name):
    """ Add framing to a test file
    :param f: A filelike object containing a test script
    :param test_name:
    :param app_name:
    :return:
    """
    test_template = """
#metadata
# {{
#   "pebble": true
# }}
#/metadata

setup {{
    context bigboard
    do factory_reset
}}

test {test_name} {{
    context bigboard

    # Load the app
    do install_app app.pbw
    do launch_app "{app_name}"
    do wait 2
{content}
}}
"""
    return test_template.format(
        test_name=test_name,
        app_name=app_name,
        content="".join('    %s' % l for l in f.readlines())
    )


def process_uploaded_test_bundle(infile, outfile):
    with zipfile.ZipFile(infile, 'a') as zip_in, zipfile.ZipFile(outfile, 'w') as zip_out:
        contents = zip_in.infolist()
        tests = {}
        apps = {}
        for entry in contents:
            path, filename = os.path.split(entry.filename)
            name, ext = os.path.splitext(filename)
            if ext == '.monkey':
                tests[path] = (name, entry)
            elif ext == '.pbw':
                apps[path] = entry
            else:
                zip_out.writestr(entry, zip_in.read(entry.filename))
        for path in tests:
            app = apps.get(path, None)
            if app:
                app_data = zip_in.read(app)
                with zipfile.ZipFile(StringIO(app_data), 'r') as zip_pbw:
                    app_short_name = json.loads(zip_pbw.read('appinfo.json'))['shortName']
                zip_out.writestr(app, app_data)
                test_name, test_entry = tests[path]
                with zip_in.open(test_entry) as script_file:
                    framed = frame_test_file(script_file, test_name, app_short_name)
                zip_out.writestr(test_entry, framed)


def local_test():
    with open('archive.zip', 'r') as infile, open('out_archive.zip', 'w') as outfile:
        process_uploaded_test_bundle(infile, outfile)


if __name__ == '__main__':
    local_test()
