""" These tests check that ide.tasks.archive.create_archive produces archives containing all expected files. """
import mock

from ide.tasks.archive import create_archive
from ide.utils.cloudpebble_test import CloudpebbleTestCase, override_settings, read_bundle
from ide.models import Project, SourceFile
from utils.fakes import FakeS3

fake_s3 = FakeS3()


class ExportTester(CloudpebbleTestCase):
    def createProject(self, options=None):
        fake_s3.reset()
        self.login(options)
        self.project = Project.objects.get(pk=self.project_id)
        SourceFile.objects.create(project=self.project, file_name="main.c", target="app").save_file('file_contents')

    def run_test(self, expected_filenames, options=None):
        self.createProject(options)
        create_archive(self.project_id)
        data = read_bundle(fake_s3.read_last_file())
        filenames = set(data.keys())
        self.assertSetEqual(filenames, expected_filenames)


@override_settings(NPM_MANIFEST_SUPPORT='')
@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.files.s3', fake_s3)
class TestExportWithoutNPMSupport(ExportTester):
    def test_export_sdk_3_project(self):
        """ With package.json support off, check that SDK3 projects are exported with appinfo.json files """
        self.run_test({'test/src/main.c', 'test/appinfo.json', 'test/wscript', 'test/jshintrc'})

    def test_export_sdk_2_project(self):
        """ Check that SDK2 projects are exported with appinfo.json files """
        self.run_test({'test/src/main.c', 'test/appinfo.json', 'test/wscript', 'test/jshintrc'}, {'sdk': '2'})


@override_settings(NPM_MANIFEST_SUPPORT='yes')
@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.files.s3', fake_s3)
class TestExportWithNPMSupport(ExportTester):
    def test_export_sdk_3_project(self):
        """ With package.json support off, check that SDK3 projects are exported with package.json files """
        self.run_test({'test/src/main.c', 'test/package.json', 'test/wscript', 'test/jshintrc'})

    def test_export_sdk_2_project(self):
        """ Check that SDK2 projects are exported with appinfo.json files even with package.json support on """
        self.run_test({'test/src/main.c', 'test/appinfo.json', 'test/wscript', 'test/jshintrc'}, {'sdk': '2'})
