from social.backends.oauth import BaseOAuth2
from django.conf import settings

class PebbleOAuth2(BaseOAuth2):
    name = 'pebble'
    AUTHORIZATION_URL = '{0}/oauth/authorize'.format(settings.SOCIAL_AUTH_PEBBLE_ROOT_URL)
    ACCESS_TOKEN_URL = '{0}/oauth/token'.format(settings.SOCIAL_AUTH_PEBBLE_ROOT_URL)
    ACCESS_TOKEN_METHOD = 'POST'
    STATE_PARAMETER = 'state'
    DEFAULT_SCOPE = ['public']

    def get_user_details(self, response):
        return {
            'email': response.get('email'),
            'fullname': response.get('name'),
            'username': response.get('email'),
        }

    def user_data(self, access_token, *args, **kwargs):
        url = '{0}/api/v1/me.json'.format(settings.SOCIAL_AUTH_PEBBLE_ROOT_URL)
        return self.get_json(
            url,
            headers={'Authorization': 'Bearer {0}'.format(access_token)}
        )
