import datetime
import time
import json
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST, require_safe
from django.utils.translation import ugettext as _
from ide.models.project import Project
from ide.models.files import SourceFile
from utils.td_helper import send_td_event
from utils.jsonview import json_view, BadRequest

__author__ = 'katharine'


@require_POST
@login_required
@json_view
def create_source_file(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        f = SourceFile.objects.create(project=project,
                                      file_name=request.POST['name'],
                                      target=request.POST.get('target', 'app'))
        f.save_text(request.POST.get('content', ''))

    except IntegrityError as e:
        raise BadRequest(str(e))

    send_td_event('cloudpebble_create_file', data={
        'data': {
            'filename': request.POST['name'],
            'kind': 'source',
            'target': f.target
        }
    }, request=request, project=project)

    return {
        'file': {
            'id': f.id,
            'name': f.file_name,
            'target': f.target,
            'file_path': f.project_path
        }
    }


@require_safe
@csrf_protect
@login_required
@json_view
def load_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)

    content = source_file.get_contents()

    try:
        folded_lines = json.loads(source_file.folded_lines)
    except ValueError:
        folded_lines = []

    send_td_event('cloudpebble_open_file', data={
        'data': {
            'filename': source_file.file_name,
            'kind': 'source'
        }
    }, request=request, project=project)

    return {
        'source': content,
        'modified': time.mktime(source_file.last_modified.utctimetuple()),
        'folded_lines': folded_lines
    }


@require_safe
@csrf_protect
@login_required
@json_view
def source_file_is_safe(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    client_modified = datetime.datetime.fromtimestamp(int(request.GET['modified']))
    server_modified = source_file.last_modified.replace(tzinfo=None, microsecond=0)
    is_safe = client_modified >= server_modified
    return {'safe': is_safe}


@require_POST
@login_required
@json_view
def rename_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    old_filename = source_file.file_name

    if source_file.file_name != request.POST['old_name']:
        send_td_event('cloudpebble_rename_abort_unsafe', data={
            'data': {
                'filename': source_file.file_name,
                'kind': 'source'
            }
        }, request=request, project=project)
        raise BadRequest(_("Could not rename, file has been renamed already."))
    if source_file.was_modified_since(int(request.POST['modified'])):
        send_td_event('cloudpebble_rename_abort_unsafe', data={
            'data': {
                'filename': source_file.file_name,
                'kind': 'source',
                'modified': time.mktime(source_file.last_modified.utctimetuple()),
            }
        }, request=request, project=project)
        raise BadRequest(_("Could not rename, file has been modified since last save."))
    source_file.file_name = request.POST['new_name']
    source_file.save()

    send_td_event('cloudpebble_rename_file', data={
        'data': {
            'old_filename': old_filename,
            'new_filename': source_file.file_name,
            'kind': 'source'
        }
    }, request=request, project=project)
    return {'modified': time.mktime(source_file.last_modified.utctimetuple()), 'file_path': source_file.project_path}


@require_POST
@login_required
@json_view
def save_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    if source_file.was_modified_since(int(request.POST['modified'])):
        send_td_event('cloudpebble_save_abort_unsafe', data={
            'data': {
                'filename': source_file.file_name,
                'kind': 'source'
            }
        }, request=request, project=project)
        raise Exception(_("Could not save: file has been modified since last save."))
    source_file.save_text(request.POST['content'])
    source_file.save_lines(folded_lines=request.POST['folded_lines'])

    send_td_event('cloudpebble_save_file', data={
        'data': {
            'filename': source_file.file_name,
            'kind': 'source'
        }
    }, request=request, project=project)

    return {'modified': time.mktime(source_file.last_modified.utctimetuple())}


@require_POST
@login_required
@json_view
def delete_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)

    source_file.delete()

    send_td_event('cloudpebble_delete_file', data={
        'data': {
            'filename': source_file.file_name,
            'kind': 'source'
        }
    }, request=request, project=project)
