""" These tests check basic operation of ide.tasks.archive.do_import_archive """
import mock

from django.core.exceptions import ValidationError

from ide.tasks.archive import do_import_archive, InvalidProjectArchiveException
from ide.utils.cloudpebble_test import CloudpebbleTestCase, make_package, make_appinfo, build_bundle, override_settings
from ide.models.project import Project
from utils.fakes import FakeS3

__author__ = 'joe'

fake_s3 = FakeS3()


@mock.patch('ide.models.s3file.s3', fake_s3)
class TestImportArchive(CloudpebbleTestCase):
    def setUp(self):
        self.login()

    @staticmethod
    def make_resource_spec(name='IMAGE_BLAH'):
        return {
            'resources': {
                'media': [{
                    'file': 'images/blah.png',
                    'name': name,
                    'type': 'bitmap'
                }]
            }
        }

    def test_import_basic_bundle_with_appinfo(self):
        """ Check that a minimal bundle imports without error """
        bundle = build_bundle({
            'src/main.c': '',
            'appinfo.json': make_appinfo()
        })
        do_import_archive(self.project_id, bundle)

    def test_throws_with_invalid_appinfo(self):
        """ Check that appinfo validation is performed with a few invalid values """
        invalid_things = [
            ('projectType', 'invalid'),
            ('sdkVersion', '1'),
            ('versionLabel', '01.0'),
        ]
        for k, v in invalid_things:
            bundle = build_bundle({
                'src/main.c': '',
                'appinfo.json': make_appinfo({k: v})
            })
            with self.assertRaises(ValidationError):
                do_import_archive(self.project_id, bundle)

    def test_import_basic_bundle_with_npm_manifest(self):
        """ Check that archives with package.json can be imported """
        bundle = build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={'name': 'myproject'})
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.app_long_name, 'test')
        self.assertEqual(project.app_short_name, 'myproject')

    def test_import_package_with_dependencies(self):
        """ Check that dependencies in a package.json file are imported into the database """
        deps = {
            'some_package': '3.14.15',
            'another': 'http://blah.com/package.git',
        }
        bundle = build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={
                'dependencies': deps
            })
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        actual_deps = {d.name: d.version for d in project.dependencies.all()}
        self.assertDictEqual(actual_deps, deps)

    def test_import_package_with_keywords(self):
        """ Check that keywords in a package.json file are imported into the database """
        keywords = ['pebbles', 'watch', 'bunnies']
        bundle = build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={
                'keywords': keywords
            })
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(set(keywords), set(project.keywords))

    def test_import_appinfo_with_resources(self):
        """ Check that a resource can be imported in an appinfo.json project """
        bundle = build_bundle({
            'src/main.c': '',
            'resources/images/blah.png': 'contents!',
            'appinfo.json': make_appinfo(options=self.make_resource_spec())
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.resources.get().variants.get().get_contents(), 'contents!')

    def test_import_package_with_resources(self):
        """ Check that a resource can be imported in an package.json project """
        bundle = build_bundle({
            'src/main.c': '',
            'resources/images/blah.png': 'contents!',
            'package.json': make_package(pebble_options=self.make_resource_spec())
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.resources.get().variants.get().get_contents(), 'contents!')

    def test_throws_with_local_file_dependencies(self):
        """ Throw if any dependencies reference local files """
        bad_versions = [
            'file:security/breach',
            '/security/breach',
            './security/breach',
            '../security/breach',
            '~/security/breach'
        ]
        for version in bad_versions:
            bundle = build_bundle({
                'src/main.c': '',
                'package.json': make_package(package_options={
                    'dependencies': {'some_package': version}
                })
            })
            with self.assertRaises(ValidationError):
                do_import_archive(self.project_id, bundle)

    def test_throws_if_sdk2_project_has_array_appkeys(self):
        """ Throw when trying to import an sdk 2 project with array appkeys """
        bundle = build_bundle({
            'src/main.c': '',
            'appinfo.json': make_appinfo(options={'appKeys': [], 'sdkVersion': '2'})
        })
        with self.assertRaises(ValidationError):
            do_import_archive(self.project_id, bundle)

    def test_invalid_resource_id(self):
        """ Check that invalid characters are banned from resource IDs """
        bundle = build_bundle({
            'src/main.c': '',
            'resources/images/blah.png': 'contents!',
            'package.json': make_package(pebble_options=self.make_resource_spec("<>"))
        })

        with self.assertRaises(ValidationError):
            do_import_archive(self.project_id, bundle)

    def test_import_json_file(self):
        """ Check that json files are correctly imported """
        bundle = build_bundle({
            'src/js/test.json': '{}',
            'src/main.c': '',
            'package.json': make_package()
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.source_files.filter(file_name='test.json').count(), 1)

    def test_import_rocky(self):
        """ Check that json files are correctly imported """
        bundle = build_bundle({
            'src/rocky/index.js': '',
            'src/common/lib.js': '',
            'src/pkjs/app.js': '',
            'package.json': make_package(pebble_options={'projectType': 'rocky'})
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.source_files.filter(file_name='index.js', target='app').count(), 1)
        self.assertEqual(project.source_files.filter(file_name='lib.js', target='common').count(), 1)
        self.assertEqual(project.source_files.filter(file_name='app.js', target='pkjs').count(), 1)


@mock.patch('ide.models.s3file.s3', fake_s3)
class TestImportLibrary(CloudpebbleTestCase):
    def setUp(self):
        self.login(type='package')

    def test_import_basic_library(self):
        """ Try importing a basic library """
        bundle = build_bundle({
            'include/my-lib.h': '',
            'package.json': make_package(pebble_options={'projectType': 'package'}),
            'src/c/my-lib.c': '',
            'src/c/my-priv.h': '',
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        files = {f.file_name: f for f in project.source_files.all()}
        self.assertSetEqual(set(files.keys()), {'my-lib.h', 'my-lib.c', 'my-priv.h'})
        self.assertEqual(files['my-lib.h'].target, 'public')
        self.assertEqual(files['my-lib.c'].target, 'app')
        self.assertEqual(files['my-priv.h'].target, 'app')

    def test_import_library_with_resources(self):
        """ Try importing a basic library with resources """
        bundle = build_bundle({
            'package.json': make_package(pebble_options={
                'projectType': 'package',
                'resources': {'media': [{
                    'type': 'bitmap',
                    'name': 'MY_RES1',
                    'file': 'res1.png'
                }, {
                    'type': 'bitmap',
                    'name': 'MY_RES2',
                    'file': 'res2.png'
                }]}
            }),
            'src/resources/res1.png': '',
            'src/resources/res2.png': '',
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertSetEqual({f.file_name for f in project.resources.all()}, {'res1.png', 'res2.png'})
