from unittest import TestCase
from ide.utils.project import find_project_root_and_manifest, BaseProjectItem
import json


class FakeProjectItem(BaseProjectItem):
    def __init__(self, name, content=None):
        self.name = name
        self.content = content

    def read(self):
        if self.content is not None:
            return self.content
        if self.name.endswith('package.json'):
            return json.dumps({'pebble': {}})
        return ''

    @property
    def path(self):
        return self.name


class TestFindProjectRoot(TestCase):
    def run_test(self, filenames, expected_dir=None, expected_name=None):
        base_dir, manifest = find_project_root_and_manifest([(FakeProjectItem(item) if not isinstance(item, FakeProjectItem) else item) for item in filenames])
        if expected_dir:
            self.assertEqual(base_dir, expected_dir)
        if expected_name:
            self.assertEqual(manifest.name, expected_name)

    def test_find_appinfo_at_root(self):
        self.run_test(["appinfo.json", "src/", "src/main.c"], "", "appinfo.json")

    def test_find_appinfo_in_folder_called_appinfo(self):
        self.run_test(["appinfo.json/appinfo.json", "appinfo.json/src/", "appinfo.json/src/main.c"], "appinfo.json/")

    def test_find_appinfo_in_dir(self):
        self.run_test(["blah/appinfo.json", "blah/src/", "blah/src/main.c"], "blah/", "blah/appinfo.json")

    def test_throws_without_sources(self):
        with self.assertRaises(Exception):
            find_project_root_and_manifest(["appinfo.json", "src/"])

    def test_throws_if_appinfo_misplaced(self):
        with self.assertRaises(Exception):
            self.run_test(["src/appinfo.json", "src/", "src/main.c"])

    def throws_if_appinfo_is_directory(self):
        with self.assertRaises(Exception):
            self.run_test(["appinfo.json/thing", "appinfo.json/src/", "appinfo.json/src/main.c"])

    def test_find_package_json(self):
        self.run_test(["project/package.json", "project/src/", "project/src/main.c"], "project/", "project/package.json")

    def test_find_valid_project_alongside_invalid_project(self):
        self.run_test([
            "invalid/package.json",
            "valid/package.json",
            "invalid/src/",
            "valid/src/",
            "valid/src/app.js"
        ], "valid/", "valid/package.json")

    def test_ignore_invalid_package_file(self):
        self.run_test([
            FakeProjectItem("package.json", "{}"),
            "src/"
            "src/main.c",
            "real_project/",
            "real_project/appinfo.json",
            "real_project/src/",
            "real_project/src/main.c"
        ], "real_project/", "real_project/appinfo.json")
