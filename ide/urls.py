from django.conf.urls import patterns, url

from ide import views

urlpatterns = patterns(
    '',
    url(r'^$', views.index, name='index'),
    url(r'^project/create', views.create_project, name='create_project'),
    url(r'^project/(?P<project_id>\d+)$', views.project, name='project'),
    url(r'^project/(?P<project_id>\d+)/info', views.project_info, name='project_info'),
    url(r'^project/(?P<project_id>\d+)/save_settings', views.save_project_settings, name='save_project_settings'),
    url(r'^project/(?P<project_id>\d+)/delete', views.delete_project, name='delete_project'),
    url(r'^project/(?P<project_id>\d+)/create_source_file', views.create_source_file, name='create_source_file'),
    url(r'^project/(?P<project_id>\d+)/source/(?P<file_id>\d+)/load', views.load_source_file, name='load_source_file'),
    url(r'^project/(?P<project_id>\d+)/source/(?P<file_id>\d+)/save', views.save_source_file, name='save_source_file'),
    url(r'^project/(?P<project_id>\d+)/source/(?P<file_id>\d+)/delete', views.delete_source_file, name='delete_source_file'),
    url(r'^project/(?P<project_id>\d+)/create_resource', views.create_resource, name='create_resource'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/info', views.resource_info, name='resource_info'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/delete', views.delete_resource, name='delete_resource'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/update', views.update_resource, name='update_resource'),
    url(r'^project/(?P<project_id>\d+)/resource/(?P<resource_id>\d+)/get', views.show_resource, name='show_resource'),
    url(r'^project/(?P<project_id>\d+)/build/run', views.compile_project, name='compile_project'),
    url(r'^project/(?P<project_id>\d+)/build/last', views.last_build, name='get_last_build'),
    url(r'^project/(?P<project_id>\d+)/build/history', views.build_history, name='get_build_history'),
    url(r'^project/(?P<project_id>\d+)/export', views.begin_export, name='begin_export'),
    url(r'^task/(?P<task_id>[0-9a-f-]{32,36})', views.check_task, name='check_task'),
    url(r'^shortlink$', views.get_shortlink, name='get_shortlink'),
    url(r'^settings$', views.settings_page, name='settings'),
    url(r'^import/zip', views.import_zip, name='import_zip'),
    url(r'^import/github', views.import_github, name='import_github')
)
