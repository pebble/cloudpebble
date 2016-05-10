import json
from ide.utils.sdk import dict_to_pretty_json
from django.test import TestCase
from django.test.client import Client
from django.test.utils import setup_test_environment
try:
    from django.test import override_settings
except ImportError:
    from django.test.utils import override_settings

setup_test_environment()


# TODO: after moving to Django 1.9, use client.post().json() instead of json.loads(client.post().content)

class CloudpebbleTestCase(TestCase):
    """CloudpebbleTestCase provides convenience functions for other test cases"""

    def login(self, project_options=None):
        self.client = Client()
        self.client.post('/accounts/register', {'username': 'test', 'email': 'test@test.test', 'password1': 'test', 'password2': 'test'})
        login_result = self.client.login(username='test', password='test')
        self.assertTrue(login_result)
        create_data = {'name': 'test', 'template': 0, 'type': 'native', 'sdk': 3}
        if project_options:
            create_data.update(project_options)
        new_project = json.loads(self.client.post('/ide/project/create', create_data).content)
        self.assertTrue(new_project['success'])
        self.project_id = new_project['id']


def make_appinfo(options=None):
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
        "uuid": "123e4567-e89b-12d3-a456-426655440000",
        "versionLabel": "1.0",
        "watchapp": {
            "watchface": False
        }
    }

    if options:
        appinfo.update(options)
    return dict_to_pretty_json(appinfo)


def make_package(package_options=None, pebble_options=None, no_pebble=False):
    package = {
        "author": "test",
        "dependencies": {},
        "keywords": [],
        "name": "test",
        "pebble": {
            "appKeys": {},
            "capabilities": [
                ""
            ],
            "displayName": "test",
            "enableMultiJS": True,
            "projectType": "native",
            "resources": {
                "media": []
            },
            "sdkVersion": "3",
            "uuid": '123e4567-e89b-12d3-a456-426655440000',
            "watchapp": {
                "watchface": False
            }
        },
        "version": "1.0"
    }
    if package_options:
        package.update(package_options)
    if pebble_options:
        package['pebble'].update(pebble_options)
    if no_pebble:
        del package['pebble']
    return dict_to_pretty_json(package)
