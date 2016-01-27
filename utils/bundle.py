import os
import zipfile
import tempfile
import shutil
import contextlib
import requests
import urllib
from django.db import transaction
from io import BytesIO
from ide.models.monkey import TestRun, TestSession, TestFile


def zip_directory(input_dir, output_zip):
    """ Zip up a directory and preserve symlinks and empty directories
    Adapted from https://gist.github.com/kgn/610907

    :param input_dir: Directory to zip up
    :param output_zip: Location of output file
    :return:
    """
    zip_out = zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED)

    root_len = len(os.path.dirname(input_dir))

    def _ArchiveDirectory(parent_directory):
        contents = os.listdir(parent_directory)
        # Do not allow empty directories
        if not contents:
            raise ValueError("Input direcotry should not contain any empty directories.")
        for item in contents:
            full_path = os.path.join(parent_directory, item)
            if os.path.isdir(full_path) and not os.path.islink(full_path):
                _ArchiveDirectory(full_path)
            else:
                archive_root = full_path[root_len:].replace('\\', '/').lstrip('/')
                if os.path.islink(full_path):
                    # http://www.mail-archive.com/python-list@python.org/msg34223.html
                    zip_info = zipfile.ZipInfo(archive_root)
                    zip_info.create_system = 3
                    # Long type of hex val of '0xA1ED0000L',
                    # say, symlink attr magic...
                    zip_info.external_attr = 2716663808L
                    zip_out.writestr(zip_info, os.readlink(full_path))
                else:
                    zip_out.write(full_path, archive_root, zipfile.ZIP_DEFLATED)
    _ArchiveDirectory(input_dir)

    zip_out.close()


class TestBundle(object):
    def __init__(self, project, test_ids=None):
        print test_ids
        if test_ids is not None:
            self.tests = TestFile.objects.filter(project=project, id__in=test_ids)
        else:
            self.tests = project.test_files.all()
        self.project = project
        self.orch_url = 'http://orchestrator.hq.getpebble.com'

    def upload_to_orchestrator(self):
        """ Post the bundle to orchestrator's upload endpoint
        :return: URL of the uploaded bundle
        """

        upload_api = "%s/api/upload" % self.orch_url

        with self.open(include_pbw=True) as f:
            result = requests.post(upload_api, files=[("file", ("test_archive.test", f))])
        result.raise_for_status()
        # Get the download link
        return "%s/api/download/test_bundle/%s" % (self.orch_url, result.json()['filename'])

    def run_on_orchestrator(self, notify_url_builder):
        # Send the bundle to orchestrator
        bundle_url = self.upload_to_orchestrator()

        with transaction.atomic():
            # Set up the test session
            session, runs = self.setup_test_session(kind='batch')

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
                "name": "Project %s, Job %s" % (self.project.pk, session.id)
            }

            # Submit the orchestrator job request
            submit_url = "%s/api/jobs/submit" % self.orch_url
            result = requests.post(submit_url, json=data)
            result.raise_for_status()
        return session

    def run_on_qemu(self, server, token, verify, emu, notify_url_builder):
        # If the request fails, the test session/runs will not be created
        assert len(self.tests) == 1

        with transaction.atomic():
            session, runs = self.setup_test_session(kind='live')
            # TODO: Since we know we're communicating with localhost things, build_absolute_uri may not be appropriate.
            callback_url = notify_url_builder(session)
            post_url = server + 'qemu/%s/test' % urllib.quote_plus(emu)
            print "Posting to %s" % post_url

            with self.open(include_pbw=True) as stream:
                result = requests.post(post_url,
                                       data={'token': token, 'notify': callback_url},
                                       verify=verify,
                                       files=[('archive', ('archive.zip', stream))])

            # TODO: Consider doing something to get more meaningful error messages
            result.raise_for_status()
            return result.json(), runs[0], session

    def write_to_file(self, filename, include_pbw):
        temp_dir = tempfile.mkdtemp()
        archive_dir = os.path.join(temp_dir, 'tests')
        os.mkdir(archive_dir)
        try:
            latest_build = self.project.get_last_build()
            for test in self.tests:
                test_folder = os.path.join(archive_dir, test.file_name)
                os.mkdir(test_folder)
                test.copy_test_to_path(os.path.join(test_folder, test.file_name+'.monkey'))
                test.copy_screenshots_to_directory(test_folder)
                if include_pbw:
                    latest_build.copy_pbw_to_path(os.path.join(test_folder, "app.pbw"))
            zip_directory(archive_dir, filename)
        finally:
            shutil.rmtree(temp_dir)

    def setup_test_session(self, kind):
        assert kind in dict(TestSession.SESSION_KINDS).keys()

        with transaction.atomic():
            # Create a test session
            session = TestSession.objects.create(project=self.project, kind=kind)
            session.save()
            runs = []

            # Then make a test run for every test

            for test in self.tests:
                run = TestRun.objects.create(session=session, test=test, original_name=test.file_name)
                run.save()
                runs.append(run)

        # Return the session and its runs
        return session, runs

    @contextlib.contextmanager
    def open(self, include_pbw=False):
        temp_dir = tempfile.mkdtemp()
        location = os.path.join(temp_dir, 'archive.zip')
        try:
            self.write_to_file(location, include_pbw=include_pbw)
            with open(location, 'rb') as archive:
                yield archive
        finally:
            shutil.rmtree(temp_dir)
