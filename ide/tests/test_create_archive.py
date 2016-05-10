import mock
from zipfile import ZipFile
from io import BytesIO

from ide.tasks.archive import create_archive
from ide.utils.cloudpebble_test import CloudpebbleTestCase, override_settings
from ide.models import Project, SourceFile
from utils.fakes import FakeS3

fake_s3 = FakeS3()


class ExportTester(CloudpebbleTestCase):
    def createProject(self, options=None):
        fake_s3.reset()
        self.login(options)
        self.project = Project.objects.get(pk=self.project_id)
        SourceFile.objects.create(project=self.project, file_name="main.c", target="app").save_file('')

    @staticmethod
    def get_exported_files():
        archive = fake_s3.read_file(*fake_s3.last_key)
        with ZipFile(BytesIO(archive)) as z:
            return {x.filename for x in z.infolist()}

    def run_test(self, expected, options=None):
        self.createProject(options)
        create_archive(self.project_id)
        actual = self.get_exported_files()
        self.assertSetEqual(actual, expected)


@override_settings(NPM_MANIFEST_SUPPORT='')
@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.files.s3', fake_s3)
class TestExportWithoutNPMSupport(ExportTester):
    def test_export_sdk_3_project(self):
        self.run_test({'test/src/main.c', 'test/appinfo.json', 'test/wscript', 'test/jshintrc'})

    def test_export_sdk_2_project(self):
        self.run_test({'test/src/main.c', 'test/appinfo.json', 'test/wscript', 'test/jshintrc'}, {'sdk': '2'})


@override_settings(NPM_MANIFEST_SUPPORT='yes')
@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.files.s3', fake_s3)
class TestExportWithNPMSupport(ExportTester):
    def test_export_sdk_3_project(self):
        self.run_test({'test/src/main.c', 'test/package.json', 'test/wscript', 'test/jshintrc'})

    def test_export_sdk_2_project(self):
        self.run_test({'test/src/main.c', 'test/appinfo.json', 'test/wscript', 'test/jshintrc'}, {'sdk': '2'})
