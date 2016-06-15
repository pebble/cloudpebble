""" These tests check that ide.utils.project.find_project_root_and_manifest finds or rejects project roots in a variety of situations """

from unittest import TestCase
from ide.utils.project import find_project_root_and_manifest, BaseProjectItem, InvalidProjectArchiveException
import json


class FakeProjectItem(BaseProjectItem):
    def __init__(self, name, content=None):
        self.name = name
        self.content = content

    def read(self):
        if self.content is not None:
            return self.content
        if self.name.endswith('package.json'):
            # For convenience, if the FakeProjectItem is named package.json
            # then return a valid package.json manifest unless otherwise specified.
            return json.dumps({'pebble': {}})
        elif self.name.endswith('appinfo.json'):
            return '{}'
        return ''

    @property
    def path(self):
        return self.name


class TestFindProjectRoot(TestCase):
    def run_test(self, contents, expected_dir=None, expected_name=None):
        """Run find_project_root_and_manifest() with a list of BaseProjectItems, and check for the expected output
        :param contents: A list of either strings or FakeProjectItems
        :param expected_dir: The root dir which the function should return
        :param expected_name: The manifest filename which the function should return
        """
        base_dir, manifest = find_project_root_and_manifest([(FakeProjectItem(item) if not isinstance(item, FakeProjectItem) else item) for item in contents])
        if expected_dir:
            self.assertEqual(base_dir, expected_dir)
        if expected_name:
            self.assertEqual(manifest.name, expected_name)

    def test_find_appinfo_at_root(self):
        """ Find a project at the root of a bundle """
        self.run_test(["appinfo.json", "src/", "src/main.c"], "", "appinfo.json")

    def test_find_appinfo_in_dir(self):
        """ Find a project in a folder """
        self.run_test(["blah/appinfo.json", "blah/src/", "blah/src/main.c"], "blah/", "blah/appinfo.json")

    def test_find_appinfo_in_folder_called_appinfo(self):
        """ Find a project inside a folder called appinfo.json """
        self.run_test(["appinfo.json/appinfo.json", "appinfo.json/src/", "appinfo.json/src/main.c"], "appinfo.json/")

    def test_throws_without_sources(self):
        """ Throw if the project has no source files """
        with self.assertRaises(InvalidProjectArchiveException):
            self.run_test(["appinfo.json", "src/"])

    def test_throws_if_appinfo_misplaced(self):
        """ Throw if appinfo.json is in a subdirectory """
        with self.assertRaises(InvalidProjectArchiveException):
            self.run_test(["src/appinfo.json", "src/", "src/main.c"])

    def throws_if_appinfo_is_directory(self):
        """ Throw if appinfo.json IS a subdirectory"""
        with self.assertRaises(InvalidProjectArchiveException):
            self.run_test(["appinfo.json/", "src/", "src/main.c"])

    def test_find_npm_manifest(self):
        """ Find a project which uses package.json instead of appinfo.json """
        self.run_test(["project/package.json", "project/src/", "project/src/main.c", "project/appinfo.json"], "project/", "project/package.json")

    def test_find_valid_project_alongside_invalid_project(self):
        """ Find a valid project which is later in the file list than an invalid project """
        self.run_test([
            "invalid/appinfo.json",
            "valid/package.json",
            "invalid/src/",
            "valid/src/",
            "valid/src/app.js"
        ], "valid/", "valid/package.json")

    def throws_if_appinfo_is_invalid(self):
        """ Throw if appinfo.json doesn't contain a valid JSON object"""
        with self.assertRaises(InvalidProjectArchiveException):
            self.run_test([FakeProjectItem("appinfo.json", ""), "src/", "src/main.c"])

    def throws_if_npm_style_manifest_is_invalid(self):
        """ Throw if package.json doesn't contain a 'pebble' object"""
        with self.assertRaises(InvalidProjectArchiveException):
            self.run_test([FakeProjectItem("package.json", "{}"), "src/", "src/main.c"])

    def test_ignore_invalid_package_project(self):
        """ Ignore a package.json project which doesn't have a 'pebble' object, and find the real project instead """
        self.run_test([
            FakeProjectItem("package.json", "{}"),
            "src/"
            "src/main.c",
            "real_project/",
            "real_project/appinfo.json",
            "real_project/src/",
            "real_project/src/main.c"
        ], "real_project/", "real_project/appinfo.json")

    def test_ignore_invalid_package_file(self):
        """ If a project has an invalid package.json and an appinfo.json, select the latter """
        self.run_test([
            FakeProjectItem("package.json", "{}"),
            "src/"
            "src/main.c",
            "appinfo.json"
        ], "", "appinfo.json")

    def test_PR_317(self):
        """ PR 317 fixes a bug where find_project_root would fail with 11 character filenames """
        self.run_test([
            "MAINTAINERS",
            "package.json",
            "src/"
            "src/main.c",
        ], "", "package.json")
