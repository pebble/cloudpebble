import mock
from orchestrator_proxy.utils.auth import check_token
from unittest import TestCase
from django.test import override_settings

__author__ = 'joe'

_default_address = 'cloudpebble@pebble.com'

class TestCheckToken(TestCase):
    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=False)
    def test_when_auth_disabled(self):
        """ Test that all tokens are valid when auth is disabled """
        self.assertEqual(check_token('blah blah'), _default_address)
        self.assertEqual(check_token(''), _default_address)
        self.assertEqual(check_token(None), _default_address)

    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=True)
    def test_no_token(self):
        """ Test that invalid tokens automatically return False """
        self.assertEqual(check_token(''), False)
        self.assertEqual(check_token(None), False)

    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=True)
    @mock.patch('orchestrator_proxy.utils.auth.requests')
    def test_good_token(self, requests):
        """ Test that an email address is returned when the GET request is successful """
        requests.get.return_value.json.return_value.__getitem__.return_value = 'test.email'
        self.assertEqual(check_token('a token'), 'test.email')

    @override_settings(SOCIAL_AUTH_PEBBLE_ROOT_URL=True)
    @mock.patch('orchestrator_proxy.utils.auth.requests')
    def test_bad_token(self, requests):
        """ Test that False is returned when the GET request has an error status """
        requests.get.return_value.raise_for_status.side_effect = Exception
        self.assertEqual(check_token('a token'), False)
