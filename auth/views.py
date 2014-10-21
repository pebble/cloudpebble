from registration.backends.simple.views import RegistrationView
from django.contrib.auth import logout, login, authenticate
from django.views.generic import View
from django.shortcuts import render, redirect
from django.http.response import Http404
from django.conf import settings
from django.utils.translation import ugettext as _
from ide.api import json_failure, json_response


class IdeRegistrationView(RegistrationView):
    def get_success_url(self, *args, **kwargs):
        return "/ide/"


class IdeRegistrationMissingView(View):
    def get(self, request, *args, **kwargs):
        raise Http404()


def logout_view(request):
    logout(request)
    return redirect("/")


def login_action(request):
    username = request.REQUEST['username']
    password = request.REQUEST['password']
    user = authenticate(username=username, password=password)
    if user is None:
        return json_failure(_("Invalid username or password"))

    if not user.is_active:
        return json_failure(_("Account disabled."))

    login(request, user)
    return json_response()
