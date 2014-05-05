from django.conf.urls import patterns, url, include
from django.conf import settings

from auth import views

reg_view = views.IdeRegistrationMissingView.as_view() if settings.SOCIAL_AUTH_PEBBLE_REQUIRED else views.IdeRegistrationView.as_view()

urlpatterns = patterns(
    '',
    url(r'^register/?$', reg_view, name="registration_register"),
    url(r'^logout/?$', views.logout_view, name="logout"),
    url(r'^api/login$', views.login_action, name="login"),
    url(r'', include('registration.backends.simple.urls'))
)
