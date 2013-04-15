from django.conf.urls import patterns, url

from ide import views

urlpatterns = patterns('',
    url(r'^$', views.index, name='index'),
    url(r'^project/(?P<project_id>\d+)$', views.project, name='project'),
    url(r'^project/create$', views.create, name='create')
)
