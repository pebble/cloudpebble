from django.shortcuts import render, redirect
from django.conf import settings
from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie
def index(request):
    if request.user.is_authenticated():
        return redirect(request.GET.get('next', '/ide/'))
    else:
        return render(request, 'root/index.html', {
            'sso_root': settings.SOCIAL_AUTH_PEBBLE_ROOT_URL,
            'next': request.GET.get('next', '/ide')
        })
