""" This file contains convenience functions/classes for test cases """

import json
from zipfile import ZipFile
from io import BytesIO

from ide.models import Project, BuildResult, SourceFile, ResourceFile, ResourceVariant, ResourceIdentifier
from ide.tasks import run_compile

from ide.utils.sdk import dict_to_pretty_json
from django.test import TestCase
from django.test.client import Client
from django.test.utils import setup_test_environment
from ide.models.user import User

try:
    from django.test import override_settings
except ImportError:
    from django.test.utils import override_settings

setup_test_environment()


# TODO: after moving to Django 1.9, use client.post().json() instead of json.loads(client.post().content)

class CloudpebbleTestCase(TestCase):
    def login(self, **project_options):
        """ Create a HTTP client, create a user account, log in to CloudPebble, create a new project. """
        self.client = Client()
        self.client.post('/accounts/register', {'username': 'test', 'email': 'test@test.test', 'password1': 'test', 'password2': 'test'})
        login_result = self.client.login(username='test', password='test')
        self.user_id = next(user.id for user in User.objects.all())
        self.assertTrue(login_result)
        create_data = {'name': 'test', 'template': 0, 'type': 'native', 'sdk': '3'}
        if project_options:
            create_data.update(project_options)
        new_project = json.loads(self.client.post('/ide/project/create', create_data).content)
        self.assertTrue(new_project['success'], msg=new_project.get('error', None))
        self.project_id = new_project['id']


class ProjectTester(CloudpebbleTestCase):
    def make_project(self, **options):
        self.login(**options)
        self.project = Project.objects.get(pk=self.project_id)
        self.build_result = BuildResult.objects.create(project=self.project)

    def add_file(self, name, contents="", project=None, target="app"):
        SourceFile.objects.create(project=self.project if not project else project, file_name=name, target=target).save_text(contents)

    def add_resource(self, file_name, id_name="RESOURCE", kind="bitmap", contents="", tags=""):
        resource_file = ResourceFile.objects.create(project=self.project, kind=kind, file_name=file_name)
        resource_file.save()
        ResourceVariant.objects.create(resource_file=resource_file, tags="").save_text(contents)
        ResourceIdentifier.objects.create(resource_file=resource_file, resource_id=id_name).save()

    def compile(self):
        run_compile(self.build_result.id)
        self.build_result = BuildResult.objects.get(pk=self.build_result.id)

    def check_compile_success(self, num_platforms=4):
        self.assertEqual(self.build_result.state, BuildResult.STATE_SUCCEEDED)
        self.assertSequenceEqual([size.binary_size > 0 for size in self.build_result.sizes.all()], [True] * num_platforms)


def make_appinfo(options=None):
    """ Make an appinfo.json file
    :param options: Custom options to overwrite the defaults
    :return: A pretty-printed JSON string
    """
    appinfo = {
        "appKeys": {},
        "capabilities": [
            ""
        ],
        "companyName": "test",
        "enableMultiJS": True,
        "longName": "test",
        "projectType": "native",
        "resources": {
            "media": []
        },
        "sdkVersion": "3",
        "shortName": "test",
        "uuid": "123e4567-e89b-42d3-a456-426655440000",
        "versionLabel": "1.0",
        "watchapp": {
            "watchface": False
        }
    }

    if options:
        appinfo.update(options)
    return dict_to_pretty_json(appinfo)


def make_package(package_options=None, pebble_options=None, no_pebble=False):
    """ Make a package.json file
    :param package_options: Custom options to override the root-level keys
    :param pebble_options: Custom options to override keys in the 'pebble' object
    :param no_pebble: True if there should be no pebble object at all
    :return: pretty-printed JSON string
    """
    package = {
        "author": "test",
        "dependencies": {},
        "keywords": [],
        "name": "test",
        "pebble": {
            "messageKeys": [],
            "displayName": "test",
            "enableMultiJS": True,
            "projectType": "native",
            "resources": {
                "media": []
            },
            "sdkVersion": "3",
            "uuid": '123e4567-e89b-42d3-a456-426655440000',
            "watchapp": {
                "watchface": False
            }
        },
        "version": "1.0.0"
    }
    if package_options:
        package.update(package_options)
    if pebble_options:
        package['pebble'].update(pebble_options)
    if no_pebble:
        del package['pebble']
    return dict_to_pretty_json(package)


def build_bundle(spec):
    """ Create an in-memory zip file from a dictionary spec.
    :param spec: A dictionary. Keys are filenames, values are file contents.
    :return: A BytesIO containing the zippped up files.
    """
    bundle = BytesIO()
    with ZipFile(bundle, 'w') as zipf:
        for name, contents in spec.iteritems():
            zipf.writestr(name, contents)
    bundle.seek(0)
    return bundle.read()


def read_bundle(archive):
    """ Take a ZIP which is stored in a string and read out all file contents into a dict
    :param archive: a string containing a zip archive.
    :return:
    """
    with ZipFile(BytesIO(archive)) as z:
        return {x.filename: z.open(x).read() for x in z.infolist()}