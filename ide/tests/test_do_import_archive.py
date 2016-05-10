import mock
from zipfile import ZipFile
from io import BytesIO

from django.core.exceptions import ValidationError

from ide.tasks.archive import do_import_archive, InvalidProjectArchiveException
from ide.utils.cloudpebble_test import CloudpebbleTestCase, make_package, make_appinfo
from ide.models.project import Project
from utils.fakes import FakeS3

__author__ = 'joe'

fake_s3 = FakeS3()


@mock.patch('ide.models.files.s3', fake_s3)
class TestImportProject(CloudpebbleTestCase):
    def setUp(self):
        self.login()

    @staticmethod
    def build_bundle(spec):
        bundle = BytesIO()
        with ZipFile(bundle, 'w') as zipf:
            for name, contents in spec.iteritems():
                zipf.writestr(name, contents)
        bundle.seek(0)
        return bundle.read()

    def test_import_basic_bundle_with_appinfo(self):
        bundle = self.build_bundle({
            'src/main.c': '',
            'appinfo.json': make_appinfo()
        })
        do_import_archive(self.project_id, bundle)

    def test_throws_with_invalid_appinfo(self):
        invalid_things = [
            ('projectType', 'invalid'),
            ('sdkVersion', '1'),
            ('sdkVersion', 'nope')
        ]
        for k, v in invalid_things:
            bundle = self.build_bundle({
                'src/main.c': '',
                'appinfo.json': make_appinfo({k: v})
            })
            with self.assertRaises(ValidationError):
                do_import_archive(self.project_id, bundle)

    def test_import_basic_bundle_with_package(self):
        bundle = self.build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={'name': 'myproject'})
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.app_long_name, 'test')
        self.assertEqual(project.app_short_name, 'myproject')

    def test_import_package_with_dependencies(self):
        deps = {
            'some_package': '3.14.15',
            'another': 'http://blah.com/package.git',
        }
        bundle = self.build_bundle({
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
        keywords = ['pebbles', 'watch', 'bunnies']
        bundle = self.build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={
                'keywords': keywords
            })
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(set(keywords), set(project.keywords))

    def test_throws_with_local_file_dependencies(self):
        bundle = self.build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={
                'dependencies': {'some_package': 'file:../security/breach'}
            })
        })
        with self.assertRaises(ValidationError):
            do_import_archive(self.project_id, bundle)

    def test_throws_if_package_json_has_no_pebble_object(self):
        bundle = self.build_bundle({
            'src/main.c': '',
            'package.json': make_package(no_pebble=True)
        })
        with self.assertRaises(InvalidProjectArchiveException):
            do_import_archive(self.project_id, bundle)

    def test_conflicting_manifests_favours_package(self):
        bundle = self.build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={'name': 'package.json'}),
            'appinfo.json': make_appinfo(options={'shortName': 'appinfo.json'})
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.app_short_name, 'package.json')

    def test_use_appinfo_if_package_has_no_pebble_object(self):
        bundle = self.build_bundle({
            'src/main.c': '',
            'package.json': make_package(package_options={'name': 'package.json'}, no_pebble=True),
            'subdir/appinfo.json': make_appinfo(options={'shortName': 'appinfo.json'}),
            'subdir/src/main.c': '',
        })
        do_import_archive(self.project_id, bundle)
        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(project.app_short_name, 'appinfo.json')
