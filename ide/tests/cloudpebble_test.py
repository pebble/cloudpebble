from django.test import TestCase
from django.test.client import Client
from django.test.utils import setup_test_environment

setup_test_environment()

class CloudpebbleTestCase(TestCase):
    """CloudpebbleTestCase provides convenience functions for other test cases"""
    def login(self):
        self.client = Client()
        self.client.post('/accounts/register', {'username': 'test', 'email': 'test@test.test', 'password1': 'test', 'password2': 'test'})
        self.assertTrue(self.client.login(username='test', password='test'))
        self.assertJSONEqual(self.client.post('/ide/project/create', {'name': 'test', 'template': 0, 'type': 'native', 'sdk': 3}).content,
                             {"id": 1, "success": True})
        self.project_id = 1
