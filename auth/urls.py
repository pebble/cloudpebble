from django.conf.urls import patterns, url, include

from auth import views

urlpatterns = patterns(
    '',
    url(r'^register/?$', views.IdeRegistrationView.as_view(), name="registration_register"),
    url(r'', include('registration.backends.simple.urls'))
)
