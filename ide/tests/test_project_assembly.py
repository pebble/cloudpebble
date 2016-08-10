""" These are integration tests which check that project builds work. They are *not* run on Travis. """

import mock
import tempfile
import shutil
import os
import contextlib
from ide.utils.cloudpebble_test import ProjectTester
from ide.utils.sdk.project_assembly import assemble_project
from utils.fakes import FakeS3
from utils.filter_dict import filter_dict

__author__ = 'joe'

fake_s3 = FakeS3()


def read_tree(path):
    """ Read the directory structure of a path into a dictionary where files are True values,
    and subdirectories are more dictionaries."""
    tree = {}
    for dirpath, dirnames, filenames in os.walk(path):
        d = tree
        for x in os.path.relpath(dirpath, path).split(os.sep):
            if x == '.': continue
            d = d[x]
        for dirname in dirnames:
            d[dirname] = {}
        for filename in filenames:
            d[filename] = True
    return tree


@mock.patch('ide.models.s3file.s3', fake_s3)
class TestAssemble(ProjectTester):
    @staticmethod
    def make_expected_sdk3_project(**kwargs):
        # This is the union of all expected folder structures.
        expected = {
            'pebble-jshintrc': True,
            'package.json': True,
            'src': {
                'main.c': True,
                'app.js': True,
                'c': {
                    'lib.c': True
                },
                'js': {
                    'pebblekit': {'app.js': True}
                },
                'resources': {
                    'fonts': {},
                    'images': {},
                    'data': {},
                }
            },
            'include': {
                'lib.h': True
            },
            'worker_src': {
                'worker.c': True
            },
            'wscript': True,
            'resources': {
                'fonts': {},
                'images': {},
                'data': {},
            }
        }
        # The spec excludes items from modifies the 'expected' folder structure, determining
        # what will actually be expected when the test is run.
        spec = {
            'worker_src': False,
            'include': False,
            'src': {
                'main.c': True,
                'app.js': False
            },
            True: True
        }
        spec.update(kwargs)
        return filter_dict(expected, spec)

    @contextlib.contextmanager
    def get_tree(self, **options):
        base_dir = tempfile.mkdtemp()
        try:
            self.make_project(**options)
            yield
            assemble_project(self.project, base_dir)
            self.tree = read_tree(base_dir)
        finally:
            shutil.rmtree(base_dir)

    def test_native_SDK3(self):
        """ Check that an SDK 3 project looks right """
        with self.get_tree():
            self.add_file('main.c')
        expected = self.make_expected_sdk3_project()
        self.assertDictEqual(self.tree, expected)

    def test_native_SDK3_project_with_worker(self):
        """ Check that an SDK 3 project with a worker looks correct """
        with self.get_tree():
            self.add_file('main.c')
            self.add_file('worker.c', target='worker')
        expected = self.make_expected_sdk3_project(worker_src=True)
        self.assertDictEqual(self.tree, expected)

    def test_pebblejs(self):
        """ Check that an pebblejs project looks right """
        with self.get_tree(type='pebblejs'):
            pass
        # We can't really expect anything specific from pebblejs because, in theory, it can change under our feet.
        # But we can check things which will always be there: a doc.html and an appinfo.js
        self.assertTrue(self.tree['appinfo.json'])
        self.assertTrue(self.tree['doc.html'])

    def test_package(self):
        """ Check that an pebblejs project looks right """
        with self.get_tree(type='package'):
            self.add_file('lib.c')
            self.add_file('lib.h', public=True)
        expected = self.make_expected_sdk3_project(include=True, src={'c': True, 'resources': True}, resources=False)
        self.assertDictEqual(self.tree, expected)
