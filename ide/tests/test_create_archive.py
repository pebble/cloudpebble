""" These tests check that ide.tasks.archive.create_archive produces archives containing all expected files. """
import mock

from ide.tasks.archive import create_archive
from ide.utils.cloudpebble_test import CloudpebbleTestCase, override_settings, read_bundle
from ide.models import Project, SourceFile
from utils.fakes import FakeS3

fake_s3 = FakeS3()


class ExportTester(CloudpebbleTestCase):
    def create_project(self, options=None, files=None):
        fake_s3.reset()
        self.login(options)
        self.project = Project.objects.get(pk=self.project_id)
        for name in (files if files else {'main.c'}):
            SourceFile.objects.create(project=self.project, file_name=name, target="app").save_text('file_contents')

    def run_test(self, expected_filenames):
        create_archive(self.project_id)
        data = read_bundle(fake_s3.read_last_file())
        filenames = set(data.keys())
        expected_filenames = expected_filenames | {'test/src/main.c', 'test/wscript', 'test/jshintrc'}
        self.assertSetEqual(filenames, expected_filenames)


@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.s3file.s3', fake_s3)
class TestExport(ExportTester):
    def test_export_sdk_3_project(self):
        """ With package.json support off, check that SDK3 projects are exported with package.json files """
        self.create_project()
        self.run_test({'test/package.json'})

    def test_export_sdk_2_project(self):
        """ Check that SDK2 projects are exported with appinfo.json files even with package.json support on """
        self.create_project({'sdk': '2'})
        self.run_test({'test/appinfo.json'})

    def test_export_json(self):
        """ Check that json files are correctly exported """
        self.create_project(files={'main.c', 'test.json'})
        self.run_test({'test/package.json', 'test/src/test.json'})
