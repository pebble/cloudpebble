import uuid
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST
from github import UnknownObjectException
from ide.api import json_response, json_failure
import ide.git
from ide.models.project import Project
from ide.tasks.git import do_github_push, do_github_pull
from utils.td_helper import send_td_event

__author__ = 'katharine'


@login_required
@require_POST
def github_push(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    commit_message = request.POST['commit_message']
    task = do_github_push.delay(project.id, commit_message)
    return json_response({'task_id': task.task_id})


@login_required
@require_POST
def github_pull(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    task = do_github_pull.delay(project.id)
    return json_response({'task_id': task.task_id})


@login_required
@require_POST
def set_project_repo(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    repo = request.POST['repo']
    branch = request.POST['branch']
    auto_pull = bool(int(request.POST['auto_pull']))
    auto_build = bool(int(request.POST['auto_build']))

    repo = ide.git.url_to_repo(repo)
    if repo is None:
        return json_failure("Invalid repo URL.")
    repo = '%s/%s' % repo

    g = ide.git.get_github(request.user)
    try:
        g_repo = g.get_repo(repo)
    except UnknownObjectException:
        return json_response({'exists': False, 'access': False, 'updated': False, 'branch_exists': False})

    # TODO: Validate the branch...give user option to create one?

    with transaction.atomic():
        if repo != project.github_repo:
            if project.github_hook_uuid:
                try:
                    remove_hooks(g.get_repo(project.github_repo), project.github_hook_uuid)
                except:
                    pass

            # Just clear the repo if none specified.
            if repo == '':
                project.github_repo = None
                project.github_branch = None
                project.github_last_sync = None
                project.github_last_commit = None
                project.github_hook_uuid = None
                project.save()
                return json_response({'exists': True, 'access': True, 'updated': True, 'branch_exists': True})

            if not ide.git.git_verify_tokens(request.user):
                return json_failure("No GitHub tokens on file.")

            try:
                has_access = ide.git.check_repo_access(request.user, repo)
            except UnknownObjectException:
                return json_response({'exists': False, 'access': False, 'updated': False, 'branch_exists': False})

            if has_access:
                project.github_repo = repo
                project.github_branch = branch
                project.github_last_sync = None
                project.github_last_commit = None
                project.github_hook_uuid = None
            else:
                return json_response({'exists': True, 'access': True, 'updated': True, 'branch_exists': True})

        if branch != project.github_branch:
            project.github_branch = branch

        if auto_pull and project.github_hook_uuid is None:
            # Generate a new hook UUID
            project.github_hook_uuid = uuid.uuid4().hex
            # Set it up
            try:
                g_repo.create_hook('web', {'url': settings.GITHUB_HOOK_TEMPLATE % {'project': project.id, 'key': project.github_hook_uuid}, 'content_type': 'form'}, ['push'], True)
            except Exception as e:
                return json_failure(str(e))
        elif not auto_pull:
            if project.github_hook_uuid is not None:
                try:
                    remove_hooks(g_repo, project.github_hook_uuid)
                except:
                    pass
                project.github_hook_uuid = None

        project.github_hook_build = auto_build

        project.save()

    send_td_event('cloudpebble_project_github_linked', data={
        'data': {
            'repo': project.github_repo,
            'branch': project.github_branch
        }
    }, request=request, project=project)

    return json_response({'exists': True, 'access': True, 'updated': True, 'branch_exists': True})


@login_required
@require_POST
def create_project_repo(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    repo = request.POST['repo']
    description = request.POST['description']
    try:
        repo = ide.git.create_repo(request.user, repo, description)
    except Exception as e:
        return json_failure(str(e))
    else:
        project.github_repo = repo.full_name
        project.github_branch = "master"
        project.github_last_sync = None
        project.github_last_commit = None
        project.save()

    send_td_event('cloudpebble_created_github_repo', data={
        'data': {
            'repo': project.github_repo
        }
    }, request=request, project=project)

    return json_response({"repo": repo.html_url})


def remove_hooks(repo, s):
    hooks = list(repo.get_hooks())
    for hook in hooks:
        if hook.name != 'web':
            continue
        if s in hook.config['url']:
            hook.delete()