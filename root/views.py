from django.shortcuts import render, redirect
from django.conf import settings
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def index(request):
    next_url = request.GET.get('next', '/ide/')
    if not next_url.startswith('/'):
        next_url = '/ide/'
    if request.user.is_authenticated():
        return redirect(next_url)
    else:
        return render(request, 'root/index.html', {
            'sso_root': settings.SOCIAL_AUTH_PEBBLE_ROOT_URL,
            'next': next_url,
        })
