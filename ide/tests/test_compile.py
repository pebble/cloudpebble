""" These are integration tests which check that project builds work. They are *not* run on Travis. """

import os
import shutil
import tempfile
from unittest import skipIf, skip
from zipfile import ZipFile

import mock
from django.conf import settings
from django.test import LiveServerTestCase

from ide.models import Project, BuildResult
from ide.tasks.build import run_compile
from ide.utils.cloudpebble_test import override_settings, ProjectTester
from utils.fakes import FakeS3

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


@skipIf(settings.TRAVIS, "Travis cannot run build tests")
@mock.patch('ide.models.s3file.s3', fake_s3)
@mock.patch('ide.models.build.s3', fake_s3)
class TestCompile(ProjectTester):
    def test_native_SDK2_project(self):
        """ Check that an SDK 3 project (with package.json support off) builds successfully """
        self.make_project(sdk='2')
        self.add_file("main.c", SIMPLE_MAIN)
        self.compile()
        self.check_compile_success(num_platforms=1)

    def test_native_SDK3_project(self):
        """ Check that an SDK 3 project (with package.json support on) builds successfully """
        self.make_project()
        self.add_file("main.c", SIMPLE_MAIN)
        self.compile()
        self.check_compile_success()

        # self.check_package_manifest(manifest, package_options={'dependencies': deps})

    @override_settings(LOCAL_DEPENDENCY_OVERRIDE=True)
    def test_project_with_dependencies(self):
        """ Check that an SDK 3 project with dependencies builds successfully """
        self.make_project()
        # 'test_library.zip' is not currently compiled for diorite.
        self.project.app_platforms = "aplite,basalt,chalk"
        self.project.save()
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
            self.check_compile_success(num_platforms=3)
        finally:
            shutil.rmtree(tempdir)


@skip
@skipIf(settings.TRAVIS, "Travis cannot run build tests")
@override_settings(TESTING=False)  # This fully enables S3. This is OK since the tests are not run on Travis.
class TestCompileLive(LiveServerTestCase, ProjectTester):
    """ In order to run this test, we need to run a full webserver with S3 access so that npm
    can download the interdependency """

    def test_project_with_interdependencies(self):
        """ Check that (a) we can build packages, (b) we can build projects which depend on them. """
        self.make_project()
        # Build the package
        package = Project.objects.create(name='test', sdk_version='3', project_type='package', app_short_name='libname', owner_id=self.user_id)
        self.add_file("whatever.c", LIBRARY_C, project=package)
        self.add_file("whatever.h", LIBRARY_H, project=package)
        package_build_result = BuildResult.objects.create(project=package)
        run_compile(package_build_result.id)
        # Set up the project which depends on the package
        self.project.project_dependencies.add(package)
        self.add_file("main.c", DEPENDENCY_MAIN)
        self.compile()
        self.check_compile_success()
