from social.backends.oauth import BaseOAuth2
from django.conf import settings
from ide.models.user import UserGithub
from ide.models.project import Project
import ide.utils.mailinglist as mailinglist

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

def merge_user(strategy, uid, user=None, *args, **kwargs):
    provider = strategy.backend.name
    social = strategy.storage.user.get_social_auth(provider, uid)
    if social:
        if user and social.user != user:
            # msg = 'This {0} account is already in use.'.format(provider)
            # raise AuthAlreadyAssociated(strategy.backend, msg)
            # Try merging the users.
            # Do this first, simply because it's both most important and most likely to fail.
            Project.objects.filter(owner=social.user).update(owner=user)
            # If one user has GitHub settings and the other doesn't, use them.
            try:
                github = UserGithub.objects.get(user=social.user)
                if github:
                    if UserGithub.objects.filter(user=user).count() == 0:
                        github.user = user
                        github.save()
            except UserGithub.DoesNotExist:
                pass
            # Delete our old social user.
            social.user.delete()
            social = None

        elif not user:
            user = social.user
            mailinglist.add_user(user)
    return {'social': social,
            'user': user,
            'is_new': user is None,
            'new_association': False}

def clear_old_login(strategy, uid, user=None, *args, **kwargs):
    provider = strategy.backend.name
    social = strategy.storage.user.get_social_auth(provider, uid)
    if user and social and user == social.user:
        if user.has_usable_password():
            user.set_unusable_password()
