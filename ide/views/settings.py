import base64
import urllib
import urllib2
import uuid
import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_safe, require_POST
from ide.forms import SettingsForm
from ide.models.user import UserGithub
from utils.td_helper import send_td_event

__author__ = 'katharine'


@login_required
def settings_page(request):
    user_settings = request.user.settings
    try:
        github = request.user.github
    except UserGithub.DoesNotExist:
        github = None

    if request.method == 'POST':
        form = SettingsForm(request.POST, instance=user_settings)
        if form.is_valid():
            form.save()
            send_td_event('cloudpebble_change_user_settings', request=request)
            return render(request, 'ide/settings.html', {'form': form, 'saved': True, 'github': github})

    else:
        form = SettingsForm(instance=user_settings)

    send_td_event('cloudpebble_view_user_settings', request=request)

    return render(request, 'ide/settings.html', {'form': form, 'saved': False, 'github': github})


@login_required
@require_POST
def start_github_auth(request):
    nonce = uuid.uuid4().hex
    try:
        user_github = request.user.github
    except UserGithub.DoesNotExist:
        user_github = UserGithub.objects.create(user=request.user)
    user_github.nonce = nonce
    user_github.save()
    send_td_event('cloudpebble_github_started', request=request)
    return HttpResponseRedirect('https://github.com/login/oauth/authorize?client_id=%s&scope=repo&state=%s' %
                                (settings.GITHUB_CLIENT_ID, nonce))


@login_required
@require_POST
def remove_github_auth(request):
    try:
        user_github = request.user.github
        user_github.delete()
    except UserGithub.DoesNotExist:
        pass
    send_td_event('cloudpebble_github_revoked', request=request)
    return HttpResponseRedirect('/ide/settings')


@login_required
@require_safe
def complete_github_auth(request):
    if 'error' in request.GET:
        return HttpResponseRedirect('/ide/settings')
    nonce = request.GET['state']
    code = request.GET['code']
    user_github = request.user.github
    if user_github.nonce is None or nonce != user_github.nonce:
        return HttpResponseBadRequest('nonce mismatch.')
    # This probably shouldn't be in a view. Oh well.
    params = urllib.urlencode({
        'client_id': settings.GITHUB_CLIENT_ID,
        'client_secret': settings.GITHUB_CLIENT_SECRET,
        'code': code
    })
    r = urllib2.Request('https://github.com/login/oauth/access_token', params, headers={'Accept': 'application/json'})
    result = json.loads(urllib2.urlopen(r).read())
    user_github = request.user.github
    user_github.token = result['access_token']
    user_github.nonce = None
    # Try and figure out their username.
    auth_string = base64.encodestring('%s:%s' %
                                      (settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET)).replace('\n', '')

    r = urllib2.Request('https://api.github.com/applications/%s/tokens/%s' %
                        (settings.GITHUB_CLIENT_ID, user_github.token))

    r.add_header("Authorization", "Basic %s" % auth_string)
    result = json.loads(urllib2.urlopen(r).read())
    user_github.username = result['user']['login']
    user_github.avatar = result['user']['avatar_url']

    user_github.save()

    send_td_event('cloudpebble_github_linked', data={
        'data': {'username': user_github.username}
    }, request=request)

    return HttpResponseRedirect('/ide/settings')