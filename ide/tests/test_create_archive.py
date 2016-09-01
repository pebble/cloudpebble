"""
These tests check that ide.tasks.archive.create_archive produces archives containing all expected files.
 Although there is overlap with test_project_assembly, this function is only used for exporting projects to users.
"""
import mock

from ide.tasks.archive import create_archive
from ide.utils.cloudpebble_test import CloudpebbleTestCase, override_settings, read_bundle
from ide.models import Project, SourceFile, ResourceFile, ResourceVariant, ResourceIdentifier
from utils.fakes import FakeS3

fake_s3 = FakeS3()


class ExportTester(CloudpebbleTestCase):
    def create_project(self, files=None, **options):
        fake_s3.reset()
        self.login(**options)
        self.project = Project.objects.get(pk=self.project_id)
        for name in (files if files else {'main.c'}):
            SourceFile.objects.create(project=self.project, file_name=name, target="app").save_text('file_contents')

    def run_test(self, expected_filenames):
        create_archive(self.project_id)
        data = read_bundle(fake_s3.read_last_file())
        filenames = set(data.keys())
        expected_filenames = expected_filenames | {'test/wscript', 'test/jshintrc'}
        self.assertSetEqual(filenames, expected_filenames)


@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.s3file.s3', fake_s3)
class TestExport(ExportTester):
    def test_export_sdk_3_project(self):
        """ Ceck that SDK3 projects are exported with package.json files """
        self.create_project()
        self.run_test({'test/src/c/main.c', 'test/package.json'})

    def test_export_sdk_2_project(self):
        """ Check that SDK2 projects are exported with appinfo.json """
        self.create_project(sdk='2')
        self.run_test({'test/src/c/main.c', 'test/appinfo.json'})

    def test_export_package(self):
        """ Check that packages are exported with the correct file structure """
        self.create_project(type='package')
        SourceFile.objects.create(project=self.project, file_name="main.h", target="app").save_text('file_contents')
        SourceFile.objects.create(project=self.project, file_name="header.h", target="public").save_text('header_contents')
        SourceFile.objects.create(project=self.project, file_name="app.js", target='pkjs').save_text('js_contents')
        resource = ResourceFile.objects.create(project=self.project, file_name="cat.png", kind="bitmap")
        ResourceVariant.objects.create(resource_file=resource, tags=ResourceVariant.TAGS_DEFAULT).save_text('png_content')
        ResourceIdentifier.objects.create(resource_file=resource, resource_id='RESOURCE')

        self.run_test({
            'test/src/c/main.c',
            'test/src/c/main.h',
            'test/src/js/app.js',
            'test/include/header.h',
            'test/package.json',
            'test/src/resources/images/cat.png'
        })

    def test_export_json(self):
        """ Check that json files are correctly exported """
        self.create_project(files={'main.c', 'test.json'})
        # FIXME: this test shouldn't have a test.json in the app target.
        self.run_test({'test/src/c/main.c', 'test/package.json', 'test/src/c/test.json'})
