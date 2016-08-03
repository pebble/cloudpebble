""" These are integration tests. They create project archives, import them, export them, and then check that the manifest files are identical. """

import mock
import json

from ide.tasks.archive import do_import_archive
from ide.utils.cloudpebble_test import CloudpebbleTestCase, make_package, make_appinfo, build_bundle, read_bundle, override_settings

from ide.tasks.archive import create_archive
from utils.fakes import FakeS3

__author__ = 'joe'

fake_s3 = FakeS3()


@mock.patch('ide.tasks.archive.s3', fake_s3)
@mock.patch('ide.models.s3file.s3', fake_s3)
class TestImportExport(CloudpebbleTestCase):

    def setUp(self):
        self.login()
        self.maxDiff = None

    @staticmethod
    def make_custom_manifests(messageKeys):
        # We want to specify as many optional options as possible, in the hope that they all get exported
        # identically after being imported.
        npm_options = {
            'package_options': {
                'dependencies': {'some_package': '11.11.0'},
                'keywords': ['earth', 'wind', 'fire', 'water'],
            },
            'pebble_options': {
                'messageKeys': messageKeys
            }
        }
        appinfo_options = {
            'appKeys': messageKeys
        }
        return make_package(**npm_options), make_appinfo(appinfo_options)

    def runTest(self, manifest, import_manifest_name, expected_export_package_filename, expected_manifest=None):
        expected_manifest = expected_manifest or manifest
        bundle_file = build_bundle({
            'src/main.c': '',
            import_manifest_name: manifest
        })
        do_import_archive(self.project_id, bundle_file)
        create_archive(self.project_id)
        exported_manifest = read_bundle(fake_s3.read_last_file())[expected_export_package_filename]
        self.assertDictEqual(json.loads(expected_manifest), json.loads(exported_manifest))

    def test_import_then_export_npm_style(self):
        """ An imported then exported project manifest should remain identical, preserving all important data. """
        manifest, _ = self.make_custom_manifests(messageKeys={'key': 1, 'keytars': 2})
        self.runTest(manifest, 'package.json', 'test/package.json')

    def test_import_then_export_npm_style_with_new_messageKeys(self):
        """ We should be able to import and export SDK 3 projects with arrays for messageKeys """
        manifest, _ = self.make_custom_manifests(messageKeys=['keyLimePie', 'donkey[123]'])
        self.runTest(manifest, 'package.json', 'test/package.json')
