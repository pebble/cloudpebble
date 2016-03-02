import mock
from orchestrator_proxy.utils.auth import check_token
from unittest import TestCase
from django.test import override_settings

__author__ = 'joe'



class TestCheckToken(TestCase):
    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=False)
    def test_when_auth_disabled(self):
        """ Test that all tokens are valid when auth is disabled """
        self.assertEqual(check_token('blah blah'), True)
        self.assertEqual(check_token(''), True)
        self.assertEqual(check_token(None), True)

    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=True)
    def test_no_token(self):
        """ Test that invalid tokens automatically return False """
        self.assertEqual(check_token(''), False)
        self.assertEqual(check_token(None), False)

    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=True)
    @mock.patch('orchestrator_proxy.utils.auth.requests')
    def test_good_token(self, requests):
        """ Test that True is returned when the GET request is successful """
        requests.get.return_value.status_code = 200
        self.assertEqual(check_token('a token'), True)

    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=True)
    @mock.patch('orchestrator_proxy.utils.auth.requests')
    def test_bad_token(self, requests):
        """ Test that False is returned when the GET request has an error status """
        requests.get.return_value.raise_for_status.side_effect = Exception
        self.assertEqual(check_token('a token'), False)
