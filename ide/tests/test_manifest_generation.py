from ide.utils import sdk
from ide.utils.cloudpebble_test import CloudpebbleTestCase, make_package, make_appinfo, override_settings
from ide.models import Project, Dependency


class ManifestTester(CloudpebbleTestCase):
    def setUp(self):
        self.login()
        self.project = Project.objects.get(pk=self.project_id)

    def check_package_manifest(self, manifest, package_options=None, pebble_options=None):
        """ Check that a generated manifest file looks like a manually assembled manifest file
        :param manifest: Manifest to check
        :param package_options: root-level options to set in the 'correct' manifest file
        :param pebble_options: pebble-level options to set in the 'correct' manifest file
        """
        pebble_options = {} if pebble_options is None else pebble_options
        pebble_options['uuid'] = str(self.project.app_uuid)
        compare_to = make_package(package_options=package_options, pebble_options=pebble_options)
        self.assertEqual(manifest, compare_to)

    def check_appinfo_manifest(self, manifest, package_options=None):
        """ Check that a generated manifest file looks like a manually assembled manifest file
        :param manifest: Manifest to check
        :param package_options: root-level options to set in the 'correct' manifest file
        """
        package_options = {} if package_options is None else package_options
        package_options['uuid'] = str(self.project.app_uuid)
        compare_to = make_appinfo(package_options)
        self.assertEqual(manifest, compare_to)


@override_settings(NPM_MANIFEST_SUPPORT='yes')
class TestNPMStyleManifestGeneration(ManifestTester):
    """ Test an SDK 3 project with package.json support ON"""

    def setUp(self):
        self.login()
        self.project = Project.objects.get(pk=self.project_id)

    def test_package_manifest(self):
        manifest = sdk.generate_manifest(self.project, [])
        self.check_package_manifest(manifest)

    def test_package_manifest_with_dependencies(self):
        deps = {
            'some_package': '1.2.3',
            'another': '^4.2.0'
        }
        for name, version in deps.iteritems():
            Dependency.objects.create(project=self.project, name=name, version=version).save()

        manifest = sdk.generate_manifest(self.project, [])
        self.check_package_manifest(manifest, package_options={'dependencies': deps})

    def test_package_manifest_with_keywords(self):
        keywords = ["pebbles...", "are?!", "~{cool}~"]
        self.project.keywords = keywords
        manifest = sdk.generate_manifest(self.project, [])
        self.check_package_manifest(manifest, package_options={'keywords': keywords})


@override_settings(NPM_MANIFEST_SUPPORT='')
class TestSDK3ManifestGeneration(ManifestTester):
    """ Test an SDK 3 project with package.json support OFF"""

    def setUp(self):
        self.login()
        self.project = Project.objects.get(pk=self.project_id)

    def test_package_manifest(self):
        manifest = sdk.generate_manifest(self.project, [])
        self.check_appinfo_manifest(manifest)
