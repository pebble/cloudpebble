""" These are integration tests which check that project builds work. They are *not* run on Travis. """

import mock
import shutil
import os
from zipfile import ZipFile
import tempfile
from django.test import LiveServerTestCase
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

LIBRARY_C = """
#include <pebble.h>
#include "whatever.h"

const char * world(void) {
    return "World!";
}
"""

LIBRARY_H = """
#pragma once

const char * world(void);
"""


class CompileTester(CloudpebbleTestCase):
    def make_project(self, options=None):
        self.login(project_options=options)
        self.project = Project.objects.get(pk=self.project_id)
        self.build_result = BuildResult.objects.create(project=self.project)

    def add_file(self, name, contents):
        SourceFile.objects.create(project=self.project, file_name=name, target="app").save_text(contents)

    def compile(self):
        run_compile(self.build_result.id)
        self.build_result = BuildResult.objects.get(pk=self.build_result.id)

    def check_success(self, num_platforms=3):
        self.assertEqual(self.build_result.state, BuildResult.STATE_SUCCEEDED)
        self.assertSequenceEqual([size.binary_size > 0 for size in self.build_result.sizes.all()], [True] * num_platforms)


@skipIf(settings.TRAVIS, "Travis cannot run build tests")
@mock.patch('ide.models.s3file.s3', fake_s3)
@mock.patch('ide.models.build.s3', fake_s3)
class TestCompile(CompileTester):
    def test_native_SDK2_project(self):
        """ Check that an SDK 3 project (with package.json support off) builds successfully """
        self.make_project({'sdk': '2'})
        SourceFile.objects.create(project=self.project, file_name="main.c", target="app").save_text(SIMPLE_MAIN)
        self.compile()
        self.check_success(num_platforms=1)

    def test_native_SDK3_project(self):
        """ Check that an SDK 3 project (with package.json support on) builds successfully """
        self.make_project()
        SourceFile.objects.create(project=self.project, file_name="main.c", target="app").save_text(SIMPLE_MAIN)
        self.compile()
        self.check_success()

        # self.check_package_manifest(manifest, package_options={'dependencies': deps})

    @override_settings(LOCAL_DEPENDENCY_OVERRIDE=True)
    def test_project_with_dependencies(self):
        """ Check that an SDK 3 project with dependencies builds successfully """
        self.make_project()
        tempdir = tempfile.mkdtemp()
        try:
            # Extract a premade library to a temporary directory
            ZipFile(LIBRARY_PATH).extractall(tempdir)
            lib_path = os.path.join(tempdir, 'libname')

            # Include the library in the code and package.json
            SourceFile.objects.create(project=self.project, file_name="main.c", target="app").save_text(DEPENDENCY_MAIN)
            self.project.set_dependencies({
                'libname': lib_path
            })

            # Compile and check
            self.compile()
            self.check_success()
        finally:
            shutil.rmtree(tempdir)


@skipIf(settings.TRAVIS, "Travis cannot run build tests")
@override_settings(TESTING=False)  # This fully enables S3. This is OK since the tests are not run on Travis.
class TestCompileLive(LiveServerTestCase, CompileTester):
    """ In order to run this test, we need to run a full webserver with S3 access so that npm
    can download the interdependency """

    def test_project_with_interdependencies(self):
        """ Check that (a) we can build packages, (b) we can build projects which depend on them. """
        self.make_project()
        # Build the package
        package = Project.objects.create(name='test', sdk_version='3', project_type='package', app_short_name='libname', owner_id=self.user_id, app_keys='[]')
        SourceFile.objects.create(project=package, file_name="whatever.c", target="app").save_text(LIBRARY_C)
        SourceFile.objects.create(project=package, file_name="whatever.h", target="app", public=True).save_text(LIBRARY_H)
        package_build_result = BuildResult.objects.create(project=package)
        run_compile(package_build_result.id)
        # Set up the project which depends on the package
        self.project.project_dependencies.add(package)
        self.add_file("main.c", DEPENDENCY_MAIN)
        self.compile()
        self.check_success()
