import base64
import json
import urllib2
import re
import logging

from github import Github, BadCredentialsException, UnknownObjectException
from github.NamedUser import NamedUser
from django.utils.translation import ugettext as _
from django.conf import settings

from ide.models.user import UserGithub

logger = logging.getLogger(__name__)


def git_auth_check(f):
    def g(user, *args, **kwargs):
        if not git_verify_tokens(user):
            raise Exception(_("Invalid user GitHub tokens."))
        try:
            return f(user, *args, **kwargs)
        except BadCredentialsException:
            # Bad credentials; remove the user's auth data.
            try:
                logger.warning("Bad credentials; revoking user's github tokens.")
                github = user.github
                github.delete()
            except:
                pass
            raise

    return g


def git_verify_tokens(user):
    try:
        token = user.github.token
    except UserGithub.DoesNotExist:
        return False
    if token is None:
        return False

    auth_string = base64.encodestring('%s:%s' %
                                      (settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET)).replace('\n', '')
    r = urllib2.Request('https://api.github.com/applications/%s/tokens/%s' % (settings.GITHUB_CLIENT_ID, token))
    r.add_header("Authorization", "Basic %s" % auth_string)
    try:
        json.loads(urllib2.urlopen(r).read())
    except urllib2.HTTPError as e:
        # No such token
        if e.getcode() == 404:
            github = user.github
            github.delete()
        return False
    return True


def get_github(user):
    return Github(user.github.token, client_id=settings.GITHUB_CLIENT_ID, client_secret=settings.GITHUB_CLIENT_SECRET)


def check_repo_access(user, repo):
    g = get_github(user)
    try:
        repo = g.get_repo(repo)
    except UnknownObjectException:
        raise

    return repo.has_in_collaborators(NamedUser(None, {'login': user.github.username}, False))


def url_to_repo(url):
    match = re.match(r'^(?:https?://|git@|git://)?(?:www\.)?github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git|/|$)', url)
    if match is None:
        return None
    else:
        return match.group(1), match.group(2)


@git_auth_check
def create_repo(user, repo_name, description):
    g = get_github(user)
    user = g.get_user()
    return user.create_repo(repo_name, description=description, auto_init=True)
