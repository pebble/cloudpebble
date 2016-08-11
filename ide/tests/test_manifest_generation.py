""" These tests check that sdk.generate_manifest outputs what it should do under various conditions. """

import json
from ide.utils.sdk import generate_manifest
from ide.utils.cloudpebble_test import CloudpebbleTestCase, make_package, make_appinfo, override_settings
from ide.models import Project, Dependency, BuildResult


class ManifestTester(CloudpebbleTestCase):
    def check_package_manifest(self, manifest, package_options=None, pebble_options=None):
        """ Check that a generated manifest file looks like a manually assembled manifest file
        :param manifest: Manifest to check
        :param package_options: root-level options to set in the 'correct' manifest file
        :param pebble_options: pebble-level options to set in the 'correct' manifest file
        """
        pebble_options = {} if pebble_options is None else pebble_options
        pebble_options['uuid'] = str(self.project.app_uuid)
        compare_to = make_package(package_options=package_options, pebble_options=pebble_options)
        self.assertDictEqual(json.loads(manifest), json.loads(compare_to))

    def check_appinfo_manifest(self, manifest, package_options=None):
        """ Check that a generated manifest file looks like a manually assembled manifest file
        :param manifest: Manifest to check
        :param package_options: root-level options to set in the 'correct' manifest file
        """
        package_options = {} if package_options is None else package_options
        package_options['uuid'] = str(self.project.app_uuid)
        compare_to = make_appinfo(package_options)
        self.assertDictEqual(json.loads(manifest), json.loads(compare_to))


class TestNPMStyleManifestGeneration(ManifestTester):
    """ Test an SDK 3 project with package.json support ON"""

    def setUp(self):
        self.login()
        self.project = Project.objects.get(pk=self.project_id)

    def test_package_manifest(self):
        """ Check that the manifest create for a project is functionally identical to a generated sample manifest. """
        manifest = generate_manifest(self.project, [])
        self.check_package_manifest(manifest)

    def test_package_manifest_with_dependencies(self):
        """ Check that dependencies are represented in the package.json file. """
        deps = {
            'some_package': '1.2.3',
            'another': '^4.2.0'
        }
        self.project.set_dependencies(deps)
        manifest = generate_manifest(self.project, [])
        self.check_package_manifest(manifest, package_options={'dependencies': deps})

    def test_package_manifest_with_keywords(self):
        """ Check that saved keywords are present in the package.json file """
        self.maxDiff = None
        keywords = ["pebbles...", "are?!", "~{cool}~"]
        self.project.keywords = keywords
        manifest = generate_manifest(self.project, [])
        self.check_package_manifest(manifest, package_options={'keywords': keywords})

    def test_manifest_short_name(self):
        """ Check that app_short_name is mangled into a valid npm package name """
        self.project.app_short_name = "_CAPITALS_and...dots-and  -  spaces ! "
        manifest = generate_manifest(self.project, [])
        self.check_package_manifest(manifest, package_options={'name': 'capitals_and...dots-and-spaces'})

    def test_inter_project_dependencies(self):
        """ Check that inter-project dependencies are represented in the manifest """
        package = Project.objects.create(project_type='package', name='test_package', app_short_name='mylib', sdk_version='3', owner_id=self.user_id)
        build = BuildResult.objects.create(project=package, state=BuildResult.STATE_SUCCEEDED)
        self.project.project_dependencies.add(package)
        deps = {
            'mylib': build.package_url
        }
        manifest = generate_manifest(self.project, [])
        self.check_package_manifest(manifest, package_options={'dependencies': deps})
