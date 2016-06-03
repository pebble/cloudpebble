""" These tests check basic operation of ide.tasks.archive.do_import_archive """
import mock

from django.core.exceptions import ValidationError

from ide.tasks.archive import do_import_archive, InvalidProjectArchiveException
from ide.utils.cloudpebble_test import CloudpebbleTestCase, make_package, make_appinfo, build_bundle, override_settings
from ide.models.project import Project
from utils.fakes import FakeS3

__author__ = 'joe'

fake_s3 = FakeS3()


@mock.patch('ide.models.files.s3', fake_s3)
class TestImportProject(CloudpebbleTestCase):
    def setUp(self):
        self.login()

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

    @override_settings(NPM_MANIFEST_SUPPORT='')
    def test_throws_if_importing_array_appkeys_without_npm_manifest_support(self):
        """ Throw when trying to import a project with auto-assigned messageKeys before NPM manifest support is fully enabled """
        bundle = build_bundle({
            'src/main.c': '',
            'package.json': make_package(pebble_options={'messageKeys': []})
        })
        with self.assertRaises(InvalidProjectArchiveException):
            do_import_archive(self.project_id, bundle)
