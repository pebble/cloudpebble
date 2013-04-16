from django.conf.urls import patterns, url

from ide import views

urlpatterns = patterns('',
    url(r'^$', views.index, name='index'),
    url(r'^project/(?P<project_id>\d+)$', views.project, name='project'),
    url(r'^project/(?P<project_id>\d+)/info\.json', views.project_info, name='project_info'),
    url(r'^project/(?P<project_id>\d+)/create_source_file', views.create_source_file, name='create_source_file'),
    url(r'^project/(?P<project_id>\d+)/source/(?P<file_id>\d+)/load', views.load_source_file, name='load_source_file'),
    url(r'^project/(?P<project_id>\d+)/source/(?P<file_id>\d+)/save', views.save_source_file, name='save_source_file'),
    url(r'^project/(?P<project_id>\d+)/source/(?P<file_id>\d+)/delete', views.delete_source_file, name='delete_source_file'),
    url(r'^project/(?P<project_id>\d+)/create_resource', views.create_resource, name='create_resource'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/info', views.resource_info, name='resource_info'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/delete', views.delete_resource, name='delete_resource'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/update', views.update_resource, name='update_resource'),
    url(r'^project/create$', views.create, name='create')
)
