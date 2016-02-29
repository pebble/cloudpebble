import contextlib
import os
import shutil
import tempfile
import urllib
import zipfile
import requests

from utils import orchestrator
from django.db import transaction
from ide.models.monkey import TestRun, TestSession, TestFile


def _zip_directory(input_dir, output_zip):
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
        if test_ids is not None:
            self.tests = TestFile.objects.filter(project=project, id__in=test_ids)
        else:
            self.tests = project.test_files.all()
        self.project = project

    def run_on_orchestrator(self, notify_url_builder):
        # Send the bundle to orchestrator
        with self.open(include_pbw=True) as f:
            bundle_url = orchestrator.upload_test(f)

        with transaction.atomic():
            # Set up the test session
            session, runs = self.setup_test_session(kind='batch')
            orch_name = "Project %s, Job %s" % (self.project.pk, session.id)

            orchestrator.submit_test(bundle_url, orch_name, notify_url_builder(session))
        return session

    def run_on_qemu(self, server, token, verify, emu, notify_url_builder, update):
        # If the request fails, the test session/runs will not be created
        assert len(self.tests) == 1

        with transaction.atomic():
            session, runs = self.setup_test_session(kind='live')
            # TODO: Since we know we're communicating with localhost things, build_absolute_uri may not be appropriate.
            callback_url = notify_url_builder(session)
            post_url = server + 'qemu/%s/test' % urllib.quote_plus(emu)
            print "Posting to %s" % post_url
            data = {'token': token, 'notify': callback_url}
            if update:
                data['update'] = 'update'
            with self.open(include_pbw=True) as stream:
                result = requests.post(post_url,
                                       data=data,
                                       verify=verify,
                                       files=[('archive', ('archive.zip', stream))])

            # TODO: Consider doing something to get more meaningful error messages
            result.raise_for_status()
            return result.json(), runs[0], session

    def write_to_file(self, filename, include_pbw=True, frame_tests=True):
        temp_dir = tempfile.mkdtemp()
        archive_dir = os.path.join(temp_dir, 'tests')
        os.mkdir(archive_dir)
        try:
            latest_build = self.project.get_last_build()
            for test in self.tests:
                test_folder = os.path.join(archive_dir, test.file_name)
                os.mkdir(test_folder)
                test.copy_test_to_path(os.path.join(test_folder, test.file_name + '.monkey'), frame_test=frame_tests)
                test.copy_screenshots_to_directory(test_folder)
                if include_pbw:
                    latest_build.copy_pbw_to_path(os.path.join(test_folder, "app.pbw"))
            _zip_directory(archive_dir, filename)
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
    def open(self, include_pbw=False, frame_tests=True):
        temp_dir = tempfile.mkdtemp()
        location = os.path.join(temp_dir, 'archive.zip')
        try:
            self.write_to_file(location, include_pbw=include_pbw, frame_tests=frame_tests)
            with open(location, 'rb') as archive:
                yield archive
        finally:
            shutil.rmtree(temp_dir)
