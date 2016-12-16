""" These tests check that ide.utils.version parses and converts version strings correctly """

from django.test import TestCase

from ide.utils import version


class TestSemverConversion(TestCase):
    def run_invalid_version_test(self, version_label):
        with self.assertRaises(ValueError):
            version.version_to_semver(version_label)

    def run_invalid_semver_test(self, semver):
        with self.assertRaises(ValueError):
            version.semver_to_version(semver)

    def test_all_valid_version_to_semver(self):
        """ Check that all valid major.minor versions validate and are converted to semvers correctly """
        for x in range(256):
            self.assertEqual(version.version_to_semver("{}".format(x)), "{}.0.0".format(x))
        for x in range(256):
            for y in range(256):
                self.assertEqual(version.version_to_semver("{}.{}".format(x, y)), "{}.{}.0".format(x, y))

    def test_semvers_to_version(self):
        """ Check that valid x.y.0 semvers validate and are converted to major.minor versions correctly """
        for x in range(256):
            for y in range(256):
                self.assertEqual(version.semver_to_version("{}.{}.0".format(x, y)), "{}.{}".format(x, y))

    def test_semvers_discard_patch(self):
        """ Check that semver_to_version() discards the patch number. """
        self.assertEqual(version.semver_to_version("1.2.3"), "1.2")

    def test_invalid_versions(self):
        """ Throw errors for a variety of invalid SDK version strings """
        self.run_invalid_version_test("01")
        self.run_invalid_version_test("1.01")
        self.run_invalid_version_test(" 1.0 ")
        self.run_invalid_version_test(" ")
        self.run_invalid_version_test("00.1 ")
        self.run_invalid_version_test("1.1.5")
        self.run_invalid_version_test("1.1.0")
        self.run_invalid_version_test("abc")

    def test_invalid_semvers(self):
        """ Throw errors for a variety of invalid pebble-compatible semver strings """
        self.run_invalid_semver_test("01.1.4")
        self.run_invalid_semver_test("300.0.1")
        self.run_invalid_semver_test("6.9")
