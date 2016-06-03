""" These tests check that project builds work. They are *not* run on Travis. """

import mock
import shutil
import os
from zipfile import ZipFile
import tempfile

from ide.utils.cloudpebble_test import CloudpebbleTestCase, override_settings
from ide.models import Project, SourceFile, BuildResult
from utils.fakes import FakeS3
from unittest import skipIf
from django.conf import settings
from ide.tasks.build import run_compile

__author__ = 'joe'

fake_s3 = FakeS3()

LIBRARY_PATH = "ide/tests/test_library.zip"

SIMPLE_MAIN = """
#include <pebble.h>

int main(void) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Hello World");
}
"""

DEPENDENCY_MAIN = """
#include <pebble.h>
#include <libname/whatever.h>

int main(void) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Hello %s", world());
}
"""


@skipIf(settings.TRAVIS, "Travis cannot run build tests")
@mock.patch('ide.models.files.s3', fake_s3)
@mock.patch('ide.models.build.s3', fake_s3)
class TestCompile(CloudpebbleTestCase):

    def make_project(self, options=None):
        self.login(project_options=options)
        self.project = Project.objects.get(pk=self.project_id)
        self.build_result = BuildResult.objects.create(project=self.project)

    def add_file(self, name, contents):
        SourceFile.objects.create(project=self.project, file_name=name, target="app").save_file(contents)

    def compile(self):
        run_compile(self.build_result.id)
        self.build_result = BuildResult.objects.get(pk=self.build_result.id)

    def check_success(self, num_platforms=3):
        self.assertEqual(self.build_result.state, BuildResult.STATE_SUCCEEDED)
        self.assertSequenceEqual([size.binary_size > 0 for size in self.build_result.sizes.all()], [True]*num_platforms)

    def test_native_SDK2_project_with_appinfo(self):
        """ Check that an SDK 3 project (with package.json support off) builds successfully """
        self.make_project({'sdk': '2'})
        self.add_file("main.c", SIMPLE_MAIN)
        self.compile()
        self.check_success(num_platforms=1)

    @override_settings(NPM_MANIFEST_SUPPORT='')
    def test_native_SDK3_project_with_appinfo(self):
        """ Check that an SDK 3 project (with package.json support off) builds successfully """
        self.make_project()
        self.add_file("main.c", SIMPLE_MAIN)
        self.compile()
        self.check_success()

    @override_settings(NPM_MANIFEST_SUPPORT='yes')
    def test_native_SDK3_simple_project_with_NPM_manifest(self):
        """ Check that an SDK 3 project (with package.json support on) builds successfully """
        self.make_project()
        self.add_file("main.c", SIMPLE_MAIN)
        self.compile()
        self.check_success()

    @override_settings(NPM_MANIFEST_SUPPORT='yes', LOCAL_DEPENDENCY_OVERRIDE=True)
    def test_project_with_dependencies(self):
        """ Check that an SDK 3 project with dependencies builds successfully """
        self.make_project()
        tempdir = tempfile.mkdtemp()
        try:
            # Extract a premade library to a temporary directory
            ZipFile(LIBRARY_PATH).extractall(tempdir)
            lib_path = os.path.join(tempdir, 'libname')

            # Include the library in the code and package.json
            self.add_file("main.c", DEPENDENCY_MAIN)
            self.project.set_dependencies({
                'libname': lib_path
            })

            # Compile and check
            self.compile()
            self.check_success()
        finally:
            shutil.rmtree(tempdir)
