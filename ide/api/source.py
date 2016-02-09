import datetime
import time
import json
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST, require_safe
from django.utils.translation import ugettext as _
from django.core.exceptions import ObjectDoesNotExist
from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.files import SourceFile
from ide.models.monkey import TestFile
from utils.keen_helper import send_keen_event

__author__ = 'katharine'


@require_POST
@login_required
def create_source_file(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        with transaction.atomic():

            f = SourceFile.objects.create(project=project,
                                          file_name=request.POST['name'],
                                          target=request.POST.get('target', 'app'))
            print "Made file " + request.POST['name']
            f.save_file(request.POST.get('content', ''))
            print "Saved file"
    except IntegrityError as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_create_file', data={
            'data': {
                'filename': request.POST['name'],
                'kind': 'source',
                'target': f.target,
            }
        }, project=project, request=request)

        return json_response({"file": {"id": f.id, "name": f.file_name, "target": f.target}})


@require_POST
@login_required
def create_test_file(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        f = TestFile.objects.create(project=project,
                                    file_name=request.POST['name'])
        f.save_file(request.POST.get('content', ''))
    except IntegrityError as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_create_file', data={
            'data': {
                'filename': request.POST['name'],
                'kind': 'test'
            }
        }, project=project, request=request)

        return json_response({"file": {"id": f.id, "name": f.file_name}})

def get_source_file(kind, pk, project):
    if kind == 'source':
        return get_object_or_404(SourceFile, pk=pk, project=project)
    elif kind == 'tests':
        return get_object_or_404(TestFile, pk=pk, project=project)
    else:
        raise ValueError('Invalid source kind %s' % kind)

@require_safe
@csrf_protect
@login_required
def load_source_file(request, project_id, kind, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_source_file(kind, pk=file_id, project=project)
    try:
        content = source_file.get_contents()

        try:
            folded_lines = json.loads(source_file.folded_lines)
        except ValueError:
            folded_lines = []

        send_keen_event('cloudpebble', 'cloudpebble_open_file', data={
            'data': {
                'filename': source_file.file_name,
                'kind': kind
            }
        }, project=project, request=request)

    except Exception as e:
        return json_failure(str(e))
    else:
        return json_response({
            "success": True,
            "source": content,
            "modified": time.mktime(source_file.last_modified.utctimetuple()),
            "folded_lines": folded_lines
        })

@require_safe
@login_required
def get_test_list(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    objects = TestFile.objects.filter(project=project)

    send_keen_event('cloudpebble', 'cloudpebble_list_source', data={
        'data': {
            'kind': 'tests'
        }
    }, project=project, request=request)


    return json_response({
        "success": True,
        "tests": [{
            "modified": time.mktime(test.last_modified.utctimetuple()),
            "id": test.id,
            "name": test.file_name,
            "last_code": test.latest_code
        } for test in objects]
    })

@require_safe
@csrf_protect
@login_required
def source_file_is_safe(request, project_id, kind, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_source_file(kind, pk=file_id, project=project)
    client_modified = datetime.datetime.fromtimestamp(int(request.GET['modified']))
    server_modified = source_file.last_modified.replace(tzinfo=None, microsecond=0)
    is_safe = client_modified >= server_modified
    return json_response({'safe': is_safe})


@require_POST
@login_required
def rename_source_file(request, project_id, kind, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_source_file(kind, pk=file_id, project=project)
    old_filename = source_file.file_name
    try:
        if source_file.file_name != request.POST['old_name']:
            send_keen_event('cloudpebble', 'cloudpebble_rename_abort_unsafe', data={
                'data': {
                    'filename': source_file.file_name,
                    'kind': kind
                }
            }, project=project, request=request)
            raise Exception(_("Could not rename, file has been renamed already."))
        if source_file.was_modified_since(int(request.POST['modified'])):
            send_keen_event('cloudpebble', 'cloudpebble_rename_abort_unsafe', data={
                'data': {
                    'filename': source_file.file_name,
                    'kind': kind,
                    'modified': time.mktime(source_file.last_modified.utctimetuple()),
                }
            }, project=project, request=request)
            raise Exception(_("Could not rename, file has been modified since last save."))
        source_file.file_name = request.POST['new_name']
        source_file.save()

    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_rename_file', data={
            'data': {
                'old_filename': old_filename,
                'new_filename': source_file.file_name,
                'kind': kind
            }
        }, project=project, request=request)
        return json_response({"modified": time.mktime(source_file.last_modified.utctimetuple())})


@require_POST
@login_required
def save_source_file(request, project_id, kind, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_source_file(kind, pk=file_id, project=project)
    try:
        if source_file.was_modified_since(int(request.POST['modified'])):
            send_keen_event('cloudpebble', 'cloudpebble_save_abort_unsafe', data={
                'data': {
                    'filename': source_file.file_name,
                    'kind': kind
                }
            }, project=project, request=request)
            raise Exception(_("Could not save: file has been modified since last save."))
        source_file.save_file(request.POST['content'], folded_lines=request.POST['folded_lines'])

    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_save_file', data={
            'data': {
                'filename': source_file.file_name,
                'kind': kind
            }
        }, project=project, request=request)

        return json_response({"modified": time.mktime(source_file.last_modified.utctimetuple())})


@require_POST
@login_required
def delete_source_file(request, project_id, kind, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_source_file(kind, pk=file_id, project=project)
    try:
        source_file.delete()
    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_delete_file', data={
            'data': {
                'filename': source_file.file_name,
                'kind': kind
            }
        }, project=project, request=request)
        return json_response({})
