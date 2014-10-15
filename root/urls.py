from django.conf.urls import patterns, url, include

from root import views

urlpatterns = patterns('',
    url(r'^$', views.index, name='index'),
    url(r'^i18n/', include('django.conf.urls.i18n'))
)
