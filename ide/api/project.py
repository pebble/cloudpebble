import os
import re
import tempfile
import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction, IntegrityError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_safe, require_POST
from ide.api import json_response, json_failure
from ide.models.build import BuildResult
from ide.models.project import Project, TemplateProject
from ide.models.files import SourceFile, ResourceFile
from ide.tasks.archive import create_archive, do_import_archive
from ide.tasks.build import run_compile
from ide.tasks.gist import import_gist
from ide.tasks.git import do_import_github
from utils.keen_helper import send_keen_event

__author__ = 'katharine'


@require_safe
@login_required
def project_info(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    output = {
        'type': project.project_type,
        'success': True,
        'name': project.name,
        'last_modified': str(project.last_modified),
        'app_uuid': project.app_uuid or '',
        'app_company_name': project.app_company_name,
        'app_short_name': project.app_short_name,
        'app_long_name': project.app_long_name,
        'app_version_code': project.app_version_code,
        'app_version_label': project.app_version_label,
        'app_is_watchface': project.app_is_watchface,
        'app_capabilities': project.app_capabilities,
        'app_jshint': project.app_jshint,
        'menu_icon': project.menu_icon.id if project.menu_icon else None,
        'source_files': [{'name': f.file_name, 'id': f.id} for f in source_files],
        'resources': [{
            'id': x.id,
            'file_name': x.file_name,
            'kind': x.kind,
            'identifiers': [y.resource_id for y in x.identifiers.all()],
        } for x in resources],
        'github': {
            'repo': "github.com/%s" % project.github_repo if project.github_repo is not None else None,
            'branch': project.github_branch if project.github_branch is not None else None,
            'last_sync': str(project.github_last_sync) if project.github_last_sync is not None else None,
            'last_commit': project.github_last_commit,
            'auto_build': project.github_hook_build,
            'auto_pull': project.github_hook_uuid is not None
        }
    }

    return json_response(output)


@require_POST
@login_required
def compile_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    build = BuildResult.objects.create(project=project)
    task = run_compile.delay(build.id)
    return json_response({"build_id": build.id, "task_id": task.task_id})


@require_safe
@login_required
def last_build(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        build = project.builds.order_by('-started')[0]
    except (IndexError, BuildResult.DoesNotExist):
        return json_response({"build": None})
    else:
        b = {
            'uuid': build.uuid,
            'state': build.state,
            'started': str(build.started),
            'finished': str(build.finished) if build.finished else None,
            'id': build.id,
            'pbw': build.pbw_url,
            'log': build.build_log_url,
            'size': {
                'total': build.total_size,
                'binary': build.binary_size,
                'resources': build.resource_size
            }
        }
        return json_response({"build": b})


@require_safe
@login_required
def build_history(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        builds = project.builds.order_by('-started')[:10]
    except (IndexError, BuildResult.DoesNotExist):
        return json_response({"build": None})
    else:
        out = []
        for build in builds:
            out.append({
                'uuid': build.uuid,
                'state': build.state,
                'started': str(build.started),
                'finished': str(build.finished) if build.finished else None,
                'id': build.id,
                'pbw': build.pbw_url,
                'log': build.build_log_url,
                'debug': build.debug_info_url,
                'size': {
                    'total': build.total_size,
                    'binary': build.binary_size,
                    'resources': build.resource_size
                }
            })
        return json_response({"builds": out})


@require_safe
@login_required
def build_log(request, project_id, build_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    build = get_object_or_404(BuildResult, project=project, pk=build_id)
    try:
        log = build.read_build_log()
    except Exception as e:
        return json_failure(str(e))

    send_keen_event('cloudpebble', 'cloudpebble_view_build_log', data={
        'data': {
            'build_state': build.state
        }
    }, project=project, request=request)

    return json_response({"log": log})


@require_POST
@login_required
def create_project(request):
    name = request.POST['name']
    template_id = request.POST.get('template', None)
    if template_id is not None:
        template_id = int(template_id)
    project_type = request.POST.get('type', 'native')
    template_name = None
    try:
        with transaction.commit_on_success():
            project = Project.objects.create(
                name=name,
                owner=request.user,
                app_company_name=request.user.username,
                app_short_name=name,
                app_long_name=name,
                app_version_code=1,
                app_version_label='1.0',
                app_is_watchface=False,
                app_capabilities='',
                project_type=project_type
            )
            if template_id is not None and template_id != 0:
                template = TemplateProject.objects.get(pk=template_id)
                template_name = template.name
                template.copy_into_project(project)
            elif project_type == 'simplyjs':
                f = SourceFile.objects.create(project=project, file_name="app.js")
                f.save_file(open('{}/src/html/demo.js'.format(settings.SIMPLYJS_ROOT)).read())
            elif project_type == 'pebblejs':
                f = SourceFile.objects.create(project=project, file_name="app.js")
                f.save_file(open('{}/src/js/app.js'.format(settings.PEBBLEJS_ROOT)).read())
    except IntegrityError as e:
        return json_failure(str(e))
    else:

        send_keen_event(
            'cloudpebble',
            'cloudpebble_create_project',
            {'data': {'template': {'id': template_id, 'name': template_name}}},
            project=project,
            request=request
        )

        return json_response({"id": project.id})


@require_POST
@login_required
def save_project_settings(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        with transaction.commit_on_success():
            project.name = request.POST['name']
            project.app_uuid = request.POST['app_uuid']
            project.app_company_name = request.POST['app_company_name']
            project.app_short_name = request.POST['app_short_name']
            project.app_long_name = request.POST['app_long_name']
            project.app_version_code = int(request.POST['app_version_code'])
            project.app_version_label = request.POST['app_version_label']
            project.app_is_watchface = bool(int(request.POST['app_is_watchface']))
            project.app_capabilities = request.POST['app_capabilities']
            project.app_keys = request.POST['app_keys']
            project.app_jshint = bool(int(request.POST['app_jshint']))

            menu_icon = request.POST['menu_icon']
            if menu_icon != '':
                menu_icon = int(menu_icon)
                old_icon = project.menu_icon
                if old_icon is not None:
                    old_icon.is_menu_icon = False
                    old_icon.save()
                icon_resource = project.resources.filter(id=menu_icon)[0]
                icon_resource.is_menu_icon = True
                icon_resource.save()

            project.save()
    except IntegrityError as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_save_project_settings', project=project, request=request)

        return json_response({})


@require_POST
@login_required
def delete_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    if not bool(request.POST.get('confirm', False)):
        return json_failure("Not confirmed")
    try:
        project.delete()
    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_delete_project', project=project, request=request)
        return json_response({})


@login_required
@require_POST
def begin_export(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    result = create_archive.delay(project.id)
    return json_response({'task_id': result.task_id})


@login_required
@require_POST
def import_zip(request):
    zip_file = request.FILES['archive']
    name = request.POST['name']
    try:
        project = Project.objects.create(owner=request.user, name=name)
    except IntegrityError as e:
        return json_failure(str(e))
    task = do_import_archive.delay(project.id, zip_file.read(), delete_project=True)

    return json_response({'task_id': task.task_id, 'project_id': project.id})


@login_required
@require_POST
def import_github(request):
    name = request.POST['name']
    repo = request.POST['repo']
    branch = request.POST['branch']
    match = re.match(r'^(?:https?://|git@|git://)?(?:www\.)?github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git|/|$)', repo)
    if match is None:
        return HttpResponse(json.dumps({"success": False, 'error': "Invalid GitHub URL."}),
                            content_type="application/json")
    github_user = match.group(1)
    github_project = match.group(2)

    try:
        project = Project.objects.create(owner=request.user, name=name)
    except IntegrityError as e:
        return json_failure(str(e))

    task = do_import_github.delay(project.id, github_user, github_project, branch, delete_project=True)
    return json_response({'task_id': task.task_id, 'project_id': project.id})


@login_required
@require_POST
def do_import_gist(request):
    task = import_gist.delay(request.user.id, request.POST['gist_id'])
    return json_response({'task_id': task.task_id})
