import datetime
import time
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST, require_safe
from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.files import SourceFile
from utils.keen_helper import send_keen_event

__author__ = 'katharine'


@require_POST
@login_required
def create_source_file(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        f = SourceFile.objects.create(project=project, file_name=request.POST['name'])
        f.save_file('')
    except IntegrityError as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_create_file', data={
            'data': {
                'filename': request.POST['name'],
                'kind': 'source'
            }
        }, project=project, request=request)

        return json_response({"file": {"id": f.id, "name": f.file_name}})


@require_safe
@csrf_protect
@login_required
def load_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    try:
        content = source_file.get_contents()

        send_keen_event('cloudpebble', 'cloudpebble_open_file', data={
            'data': {
                'filename': source_file.file_name,
                'kind': 'source'
            }
        }, project=project, request=request)

    except Exception as e:
        return json_failure(str(e))
    else:
        return json_response({
            "success": True,
            "source": content,
            "modified": time.mktime(source_file.last_modified.utctimetuple())
        })


@require_safe
@csrf_protect
@login_required
def source_file_is_safe(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    client_modified = datetime.datetime.fromtimestamp(int(request.GET['modified']))
    server_modified = source_file.last_modified.replace(tzinfo=None, microsecond=0)
    is_safe = client_modified >= server_modified
    return json_response({'safe': is_safe})


@require_POST
@login_required
def save_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    try:
        expected_modification_time = datetime.datetime.fromtimestamp(int(request.POST['modified']))
        if source_file.last_modified.replace(tzinfo=None, microsecond=0) > expected_modification_time:
            send_keen_event('cloudpebble', 'cloudpebble_save_abort_unsafe', data={
                'data': {
                    'filename': source_file.file_name,
                    'kind': 'source'
                }
            }, project=project, request=request)
            raise Exception("Could not save: file has been modified since last save.")
        source_file.save_file(request.POST['content'])


    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_save_file', data={
            'data': {
                'filename': source_file.file_name,
                'kind': 'source'
            }
        }, project=project, request=request)

        return json_response({"modified": time.mktime(source_file.last_modified.utctimetuple())})


@require_POST
@login_required
def delete_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    try:
        source_file.delete()
    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_delete_file', data={
            'data': {
                'filename': source_file.file_name,
                'kind': 'source'
            }
        }, project=project, request=request)
        return json_response({})