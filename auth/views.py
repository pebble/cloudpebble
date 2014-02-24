from registration.backends.simple.views import RegistrationView
from django.views.generic import View
from django.shortcuts import render
from django.http.response import Http404
from django.conf import settings

class IdeRegistrationView(RegistrationView):
    def get_success_url(self, *args, **kwargs):
        return "/ide/"

class IdeRegistrationMissingView(View):
    def get(self, request, *args, **kwargs):
        raise Http404()

def login_split(request):
    params = ''
    if 'next' in request.GET:
        params = '?next={0}'.format(request.GET['next'])
    return render(request, 'registration/login_split.html', {
        'params': params,
        'must_sso': settings.SOCIAL_AUTH_PEBBLE_REQUIRED
    })
