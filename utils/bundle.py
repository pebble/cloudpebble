import os
import zipfile
import tempfile
import shutil
import contextlib
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
    def __init__(self, project, test_ids=None, include_pbw=False):
        if test_ids is not None:
            test_ids = [int(test_id) for test_id in test_ids.split(',')]
            self.tests = TestFile.objects.filter(project=project, id__in=test_ids)
        else:
            self.tests = project.test_files.all()
        self.project = project
        self.include_pbw = include_pbw

    def write_to_file(self, filename):
        temp_dir = tempfile.mkdtemp()
        archive_dir = os.path.join(temp_dir, 'tests')
        os.mkdir(archive_dir)
        pbw_path = os.path.join(archive_dir, 'app.pbw')
        try:
            if self.include_pbw:
                self.project.get_last_build().copy_pbw_to_path(pbw_path)
            for test in self.tests:
                test_folder = os.path.join(archive_dir, test.file_name)
                os.mkdir(test_folder)
                test.copy_test_to_path(os.path.join(test_folder, test.file_name+'.monkey'))
                test.copy_screenshots_to_directory(test_folder)
                if self.include_pbw:
                    symlink_path = os.path.join(test_folder, "app.pbw")
                    os.symlink("../app.pbw", symlink_path)
            zip_directory(archive_dir, filename)
        finally:
            shutil.rmtree(temp_dir)

    def setup_test_session(self):
        with transaction.atomic():
            # Create a test session
            session = TestSession.objects.create(project=self.project)
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
    def open(self):
        temp_dir = tempfile.mkdtemp()
        location = os.path.join(temp_dir, 'archive.zip')
        try:
            self.write_to_file(location)
            with open(location, 'rb') as archive:
                yield archive
        finally:
            shutil.rmtree(temp_dir)
