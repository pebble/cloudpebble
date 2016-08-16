""" These tests check that the gist import logic works correctly """

import mock
from collections import namedtuple
import json

from ide.utils.cloudpebble_test import CloudpebbleTestCase
from ide.models import Project, User
from ide.tasks.gist import import_gist
from utils.fakes import FakeS3

__author__ = 'joe'

fake_s3 = FakeS3()

FakeFile = namedtuple('FakeFile', ['content', 'raw_url'])


class FakeGist(object):
    def __init__(self, description=None, files=None):
        self.description = description
        self.files = files or {}
        for name, content in files.iteritems():
            self.files[name] = FakeFile(content, '')


@mock.patch('ide.models.s3file.s3', fake_s3)
class TestImportProject(CloudpebbleTestCase):
    def setUp(self):
        self.login()

    @mock.patch('ide.tasks.gist.github')
    def runTest(self, files, github, name=None):
        github.Github.return_value.get_gist.return_value = FakeGist(description=name, files=files)
        imported_id = import_gist(self.user_id, 123)
        project = Project.objects.get(pk=imported_id)
        return project

    def test_single_C_file_defaults(self):
        """ Check that a single C file gist is imported as a native SDK 2 project with the correct default settings """
        project = self.runTest({
            'main.c': 'content'
        })
        expected_name = 'Sample project'
        self.assertEqual(fake_s3.read_last_file(), 'content')
        self.assertEqual(project.sdk_version, '2')
        self.assertEqual(project.app_long_name, expected_name)
        self.assertEqual(project.app_version_label, '1.0')
        self.assertEqual(project.name, expected_name)
        self.assertEqual(project.project_type, 'native')
        self.assertEqual(project.app_is_hidden, False)
        self.assertEqual(project.owner, User.objects.get(pk=self.user_id))
        self.assertEqual(project.app_company_name, 'test')
        self.assertEqual(project.app_is_watchface, False)
        self.assertEqual(project.app_modern_multi_js, False)

    def test_gist_with_appinfo_defaults(self):
        """ Check that a gist with an appinfo.json can set sdkVersion = 3"""
        project = self.runTest({
            'main.c': 'content',
            'appinfo.json': json.dumps({
                'sdkVersion': '3'
            })
        })
        self.assertEqual(project.sdk_version, '3')
        self.assertEqual(project.project_type, 'native')

    def test_simplyjs_gists(self):
        """ Check that a gist with only simply.js imports as simplyjs projects"""
        project = self.runTest({
            'simply.js': 'content',
            'appinfo.json': '{}'
        })
        self.assertEqual(project.project_type, 'simplyjs')
        project = self.runTest({'simply.js': 'content'})
        self.assertEqual(project.project_type, 'simplyjs')

    def test_pebblejs_gists(self):
        """ Check that a gist with only app.js imports as pebblejs projects"""
        project = self.runTest({
            'app.js': 'content',
            'appinfo.json': '{}'
        })
        self.assertEqual(project.project_type, 'pebblejs')
        project = self.runTest({'app.js': 'content'})
        self.assertEqual(project.project_type, 'pebblejs')
        self.assertEqual(project.source_files.get(file_name='app.js').target, 'app')

    def test_multiple_js_files_is_not_pebblejs(self):
        """ Check that a project with app.js and other source files does not get imported as a pebblejs project """
        project = self.runTest({
            'app.js': 'js content',
            'main.c': 'c content'
        })
        self.assertEqual(project.project_type, 'native')

    def test_gist_with_npm_manifest_defaults(self):
        project = self.runTest({
            'main.c': 'content',
            'package.json': json.dumps({})
        })
        expected_name = 'Sample project'
        self.assertEqual(fake_s3.read_last_file(), 'content')
        self.assertEqual(project.sdk_version, '3')  # This default is different to appinfo.json
        self.assertEqual(project.app_modern_multi_js, True)  # This default is different to appinfo.json
        self.assertEqual(project.app_long_name, expected_name)
        self.assertEqual(project.app_version_label, '1.0')
        self.assertEqual(project.name, expected_name)
        self.assertEqual(project.project_type, 'native')
        self.assertEqual(project.app_is_hidden, False)
        self.assertEqual(project.owner, User.objects.get(pk=self.user_id))
        self.assertEqual(project.app_company_name, 'test')
        self.assertEqual(project.app_is_watchface, False)

    @mock.patch('ide.tasks.gist.urllib2')
    def test_native_project_files(self, urllib2):
        urllib2.urlopen.return_value.read.return_value = ''
        project = self.runTest({
            'main.c': '',
            'package.json': json.dumps({"pebble": {"resources": {"media": [{
                "type": "bitmap",
                "name": "IMAGE_IMG",
                "file": "img.png"
            }]}}}),
            'app.js': '',
            'img.png': ''
        })
        self.assertEqual(project.source_files.get(file_name='app.js').target, 'pkjs')
        self.assertEqual(project.source_files.get(file_name='main.c').target, 'app')
        self.assertEqual(project.resources.get(file_name='img.png').kind, "bitmap")

    def test_rocky(self):
        project = self.runTest({
            'index.js': '',
            'app.js': ''
        })
        self.assertEqual(project.project_type, 'rocky')
        self.assertEqual(project.source_files.get(file_name='index.js').target, 'app')
        self.assertEqual(project.source_files.get(file_name='app.js').target, 'pkjs')
