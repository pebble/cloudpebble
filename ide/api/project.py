import re
import json
import time

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_safe, require_POST

from ide.models.build import BuildResult
from ide.models.project import Project, TemplateProject
from ide.models.files import SourceFile, ResourceFile
from ide.tasks.archive import create_archive, do_import_archive
from ide.tasks.build import run_compile
from ide.tasks.gist import import_gist
from ide.tasks.git import do_import_github
from utils.td_helper import send_td_event
from utils.jsonview import json_view, BadRequest

__author__ = 'katharine'


@require_safe
@login_required
@json_view
def project_info(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_files = SourceFile.objects.filter(project=project).order_by('file_name')
    resources = ResourceFile.objects.filter(project=project).order_by('file_name')
    return {
        'type': project.project_type,
        'name': project.name,
        'last_modified': str(project.last_modified),
        'app_uuid': project.app_uuid or '',
        'app_company_name': project.app_company_name,
        'app_short_name': project.app_short_name,
        'app_long_name': project.app_long_name,
        'app_version_label': project.app_version_label,
        'app_is_watchface': project.app_is_watchface,
        'app_is_hidden': project.app_is_hidden,
        'app_keys': json.loads(project.app_keys),
        'parsed_app_keys': project.get_parsed_appkeys(),
        'app_is_shown_on_communication': project.app_is_shown_on_communication,
        'app_capabilities': project.app_capabilities,
        'app_jshint': project.app_jshint,
        'app_dependencies': project.get_dependencies(include_interdependencies=False),
        'interdependencies': [p.id for p in project.project_dependencies.all()],
        'sdk_version': project.sdk_version,
        'app_platforms': project.app_platforms,
        'app_modern_multi_js': project.app_modern_multi_js,
        'menu_icon': project.menu_icon.id if project.menu_icon else None,
        'source_files': [{
                             'name': f.file_name,
                             'id': f.id,
                             'target': f.target,
                             'file_path': f.project_path,
                             'lastModified': time.mktime(f.last_modified.utctimetuple())
                         } for f in source_files],
        'resources': [{
                          'id': x.id,
                          'file_name': x.file_name,
                          'kind': x.kind,
                          'identifiers': [y.resource_id for y in x.identifiers.all()],
                          'extra': {y.resource_id: y.get_options_dict(with_id=False) for y in x.identifiers.all()},
                          'variants': [y.get_tags() for y in x.variants.all()],
                      } for x in resources],
        'github': {
            'repo': "github.com/%s" % project.github_repo if project.github_repo is not None else None,
            'branch': project.github_branch if project.github_branch is not None else None,
            'last_sync': str(project.github_last_sync) if project.github_last_sync is not None else None,
            'last_commit': project.github_last_commit,
            'auto_build': project.github_hook_build,
            'auto_pull': project.github_hook_uuid is not None
        },
        'supported_platforms': project.supported_platforms
    }


@require_POST
@login_required
@json_view
def compile_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    build = BuildResult.objects.create(project=project)
    task = run_compile.delay(build.id)
    return {"build_id": build.id, "task_id": task.task_id}


@require_safe
@login_required
@json_view
def last_build(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        build = project.builds.order_by('-started')[0]
    except (IndexError, BuildResult.DoesNotExist):
        return {"build": None}
    else:
        b = {
            'uuid': build.uuid,
            'state': build.state,
            'started': str(build.started),
            'finished': str(build.finished) if build.finished else None,
            'id': build.id,
            'download': build.package_url if project.project_type == 'package' else build.pbw_url,
            'log': build.build_log_url,
            'build_dir': build.get_url(),
            'sizes': build.get_sizes(),
        }
        return {"build": b}


@require_safe
@login_required
@json_view
def build_history(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        builds = project.builds.order_by('-started')[:10]
    except (IndexError, BuildResult.DoesNotExist):
        return {"build": None}

    out = []
    for build in builds:
        out.append({
            'uuid': build.uuid,
            'state': build.state,
            'started': str(build.started),
            'finished': str(build.finished) if build.finished else None,
            'id': build.id,
            'download': build.package_url if project.project_type == 'package' else build.pbw_url,
            'log': build.build_log_url,
            'build_dir': build.get_url(),
            'sizes': build.get_sizes()
        })
    return {"builds": out}


@require_safe
@login_required
@json_view
def build_log(request, project_id, build_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    build = get_object_or_404(BuildResult, project=project, pk=build_id)

    log = build.read_build_log()

    send_td_event('cloudpebble_view_build_log', data={
        'data': {
            'build_state': build.state
        }
    }, request=request, project=project)

    return {"log": log}


@require_POST
@login_required
@json_view
def create_project(request):
    name = request.POST['name']
    template_id = request.POST.get('template', None)
    if template_id is not None:
        template_id = int(template_id)
    project_type = request.POST.get('type', 'native')
    template_name = None
    sdk_version = str(request.POST.get('sdk', '2'))
    try:
        with transaction.atomic():
            app_keys = '{}' if sdk_version == '2' else '[]'
            project = Project.objects.create(
                name=name,
                owner=request.user,
                app_company_name=request.user.username,
                app_short_name=name,
                app_long_name=name,
                app_version_label='1.0',
                app_is_watchface=False,
                app_capabilities='',
                project_type=project_type,
                sdk_version=sdk_version,
                app_keys=app_keys
            )
            if template_id is not None and template_id != 0:
                template = TemplateProject.objects.get(pk=template_id)
                template_name = template.name
                template.copy_into_project(project)
            elif project_type == 'simplyjs':
                f = SourceFile.objects.create(project=project, file_name="app.js")
                f.save_text(open('{}/src/html/demo.js'.format(settings.SIMPLYJS_ROOT)).read())
            elif project_type == 'pebblejs':
                f = SourceFile.objects.create(project=project, file_name="app.js")
                f.save_text(open('{}/src/js/app.js'.format(settings.PEBBLEJS_ROOT)).read())
            # TODO: Default file for Rocky?
            project.full_clean()
            project.save()
    except IntegrityError as e:
        raise BadRequest(str(e))
    else:
        send_td_event('cloudpebble_create_project', {'data': {'template': {'id': template_id, 'name': template_name}}},
                      request=request, project=project)

        return {"id": project.id}


@require_POST
@login_required
@json_view
def save_project_settings(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        with transaction.atomic():

            project.name = request.POST['name']
            project.app_uuid = request.POST['app_uuid']
            project.app_company_name = request.POST['app_company_name']
            project.app_short_name = request.POST['app_short_name']
            project.app_long_name = request.POST['app_long_name']
            project.app_version_label = request.POST['app_version_label']
            project.app_is_watchface = bool(int(request.POST['app_is_watchface']))
            project.app_is_hidden = bool(int(request.POST['app_is_hidden']))
            project.app_is_shown_on_communication = bool(int(request.POST['app_is_shown_on_communication']))
            project.app_capabilities = request.POST['app_capabilities']
            project.app_keys = request.POST['app_keys']
            project.app_jshint = bool(int(request.POST['app_jshint']))
            project.sdk_version = request.POST['sdk_version']
            project.app_platforms = request.POST['app_platforms']
            project.app_modern_multi_js = bool(int(request.POST['app_modern_multi_js']))

            menu_icon = request.POST['menu_icon']
            old_icon = project.menu_icon
            if menu_icon != '':
                menu_icon = int(menu_icon)
                if old_icon is not None:
                    old_icon.is_menu_icon = False
                    old_icon.save()
                icon_resource = project.resources.filter(id=menu_icon)[0]
                icon_resource.is_menu_icon = True
                icon_resource.save()
            elif old_icon is not None:
                old_icon.is_menu_icon = False
                old_icon.save()

            project.save()
    except IntegrityError as e:
        return BadRequest(str(e))
    else:
        send_td_event('cloudpebble_save_project_settings', request=request, project=project)


@require_POST
@login_required
@json_view
def save_project_dependencies(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        project.set_dependencies(json.loads(request.POST['dependencies']))
        project.set_interdependencies([int(x) for x in json.loads(request.POST['interdependencies'])])
        return {'dependencies': project.get_dependencies()}
    except (IntegrityError, ValueError) as e:
        raise BadRequest(str(e))
    else:
        send_td_event('cloudpebble_save_project_settings', request=request, project=project)

@require_POST
@login_required
@json_view
def delete_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    if not bool(request.POST.get('confirm', False)):
        raise BadRequest(_("Not confirmed"))
    project.delete()
    send_td_event('cloudpebble_delete_project', request=request, project=project)


@login_required
@require_POST
@json_view
def begin_export(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    result = create_archive.delay(project.id)
    return {'task_id': result.task_id}


@login_required
@require_safe
@json_view
def get_projects(request):
    """ Gets a list of all projects owned by the user.

    Accepts one possible filter: '?libraries=[id]'. If given, the list of projects
    is limited to packages, and each returned package includes a 'depended_on' attribute
    which is true if it is depended on by the project where pk=[id].
    """
    filters = {
        'owner': request.user
    }
    exclusions = {}
    parent_project = None

    libraries_for_project = int(request.GET['libraries']) if 'libraries' in request.GET else None
    if libraries_for_project:
        filters['project_type'] = 'package'
        parent_project = get_object_or_404(Project, pk=libraries_for_project, owner=request.user)
        parent_project_dependencies = parent_project.project_dependencies.all()
        exclusions['pk'] = libraries_for_project

    projects = Project.objects.filter(**filters).exclude(**exclusions)

    def process_project(project):
        data = {
            'name': project.name,
            'package_name': project.npm_name,
            'id': project.id,
            'app_version_label': project.app_version_label,
            'latest_successful_build': None
        }
        try:
            data['latest_successful_build'] = str(BuildResult.objects.filter(project=project, state=BuildResult.STATE_SUCCEEDED).latest('id').finished)
        except BuildResult.DoesNotExist:
            pass
        if parent_project:
            data['depended_on'] = project in parent_project_dependencies
        return data

    return {
        'projects': [process_project(project) for project in projects]
    }


@login_required
@require_POST
@json_view
def import_zip(request):
    zip_file = request.FILES['archive']
    name = request.POST['name']
    try:
        project = Project.objects.create(owner=request.user, name=name)
    except IntegrityError as e:
        raise BadRequest(str(e))
    task = do_import_archive.delay(project.id, zip_file.read(), delete_project=True)

    return {'task_id': task.task_id, 'project_id': project.id}


@login_required
@require_POST
@json_view
def import_github(request):
    name = request.POST['name']
    repo = request.POST['repo']
    branch = request.POST['branch']
    add_remote = (request.POST['add_remote'] == 'true')
    match = re.match(r'^(?:https?://|git@|git://)?(?:www\.)?github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git|/|$)', repo)
    if match is None:
        raise BadRequest(_("Invalid Github URL."))

    github_user = match.group(1)
    github_project = match.group(2)

    try:
        project = Project.objects.create(owner=request.user, name=name)
    except IntegrityError as e:
        raise BadRequest(str(e))

    if add_remote:
        project.github_repo = "%s/%s" % (github_user, github_project)
        project.github_branch = branch
        project.save()

    task = do_import_github.delay(project.id, github_user, github_project, branch, delete_project=True)
    return {'task_id': task.task_id, 'project_id': project.id}


@login_required
@require_POST
@json_view
def do_import_gist(request):
    task = import_gist.delay(request.user.id, request.POST['gist_id'])
    return {'task_id': task.task_id}
