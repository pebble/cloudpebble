import base64
import urllib2
import json
import os
from celery import task
from django.conf import settings
from django.utils.timezone import now
from github.GithubObject import NotSet
from github import Github, GithubException, InputGitTreeElement
from ide.git import git_auth_check, get_github
from ide.models.build import BuildResult
from ide.models.project import Project
from ide.tasks import do_import_archive, run_compile
from ide.utils.git import git_sha, git_blob
from ide.utils.project import find_project_root
from ide.utils.sdk import generate_manifest_dict, generate_manifest, generate_wscript_file
from utils.td_helper import send_td_event

__author__ = 'katharine'


@task(acks_late=True)
def do_import_github(project_id, github_user, github_project, github_branch, delete_project=False):
    try:
        url = "https://github.com/%s/%s/archive/%s.zip" % (github_user, github_project, github_branch)
        if file_exists(url):
            u = urllib2.urlopen(url)
            return do_import_archive(project_id, u.read())
        else:
            raise Exception("The branch '%s' does not exist." % github_branch)
    except Exception as e:
        try:
            project = Project.objects.get(pk=project_id)
            user = project.owner
        except:
            project = None
            user = None
        if delete_project and project is not None:
            try:
                project.delete()
            except:
                pass
        send_td_event('cloudpebble_github_import_failed', data={
            'data': {
                'reason': e.message,
                'github_user': github_user,
                'github_project': github_project,
                'github_branch': github_branch
            }
        }, user=user)
        raise


def file_exists(url):
    request = urllib2.Request(url)
    request.get_method = lambda: 'HEAD'
    try:
        urllib2.urlopen(request)
    except:
        return False
    else:
        return True


@git_auth_check
def github_push(user, commit_message, repo_name, project):
    g = Github(user.github.token, client_id=settings.GITHUB_CLIENT_ID, client_secret=settings.GITHUB_CLIENT_SECRET)
    repo = g.get_repo(repo_name)
    try:
        branch = repo.get_branch(project.github_branch or repo.master_branch)
    except GithubException:
        raise Exception("Unable to get branch.")
    commit = repo.get_git_commit(branch.commit.sha)
    tree = repo.get_git_tree(commit.tree.sha, recursive=True)

    paths = [x.path for x in tree.tree]

    next_tree = {x.path: InputGitTreeElement(path=x.path, mode=x.mode, type=x.type, sha=x.sha) for x in tree.tree}

    try:
        root = find_project_root(paths)
    except:
        root = ''
    expected_paths = set()

    def update_expected_paths(new_path):
        # This adds the path *and* its parent directories to the list of expected paths.
        # The parent directories are already keys in next_tree, so if they aren't present in expected_paths
        # then, when iterating over next_tree to see which files have been deleted, we would have to treat
        # directories as special cases.
        split_path = new_path.split('/')
        expected_paths.update('/'.join(split_path[:p]) for p in range(2, len(split_path) + 1))

    src_root = root + 'src/'
    worker_src_root = root + 'worker_src/'
    project_sources = project.source_files.all()
    has_changed = False
    for source in project_sources:
        repo_path = src_root + source.file_name
        if project.project_type == 'native':
            if source.target == 'worker':
                repo_path = worker_src_root + source.file_name
            elif project.app_modern_multi_js and source.file_name.endswith('.js'):
                repo_path = src_root + 'js/' + source.file_name

        update_expected_paths(repo_path)
        if repo_path not in next_tree:
            has_changed = True
            next_tree[repo_path] = InputGitTreeElement(path=repo_path, mode='100644', type='blob',
                                                       content=source.get_contents())
            print "New file: %s" % repo_path
        else:
            sha = next_tree[repo_path]._InputGitTreeElement__sha
            our_content = source.get_contents()
            expected_sha = git_sha(our_content)
            if expected_sha != sha:
                print "Updated file: %s" % repo_path
                next_tree[repo_path]._InputGitTreeElement__sha = NotSet
                next_tree[repo_path]._InputGitTreeElement__content = our_content
                has_changed = True

    # Now try handling resource files.
    resources = project.resources.all()
    resource_root = root + 'resources/'
    for res in resources:
        for variant in res.variants.all():
            repo_path = resource_root + variant.path
            update_expected_paths(repo_path)
            if repo_path in next_tree:
                content = variant.get_contents()
                if git_sha(content) != next_tree[repo_path]._InputGitTreeElement__sha:
                    print "Changed resource: %s" % repo_path
                    has_changed = True
                    blob = repo.create_git_blob(base64.b64encode(content), 'base64')
                    print "Created blob %s" % blob.sha
                    next_tree[repo_path]._InputGitTreeElement__sha = blob.sha
            else:
                print "New resource: %s" % repo_path
                has_changed = True
                blob = repo.create_git_blob(base64.b64encode(variant.get_contents()), 'base64')
                print "Created blob %s" % blob.sha
                next_tree[repo_path] = InputGitTreeElement(path=repo_path, mode='100644', type='blob', sha=blob.sha)

    # Manage deleted files
    for path in next_tree.keys():
        if not (any(path.startswith(root) for root in (src_root, resource_root, worker_src_root))):
            continue
        if path not in expected_paths:
            del next_tree[path]
            print "Deleted file: %s" % path
            has_changed = True

    # Compare the resource dicts
    remote_manifest_path = root + 'appinfo.json'
    remote_wscript_path = root + 'wscript'

    remote_manifest_sha = next_tree[remote_manifest_path]._InputGitTreeElement__sha if remote_manifest_path in next_tree else None
    if remote_manifest_sha is not None:
        their_manifest_dict = json.loads(git_blob(repo, remote_manifest_sha))
        their_res_dict = their_manifest_dict['resources']
    else:
        their_manifest_dict = {}
        their_res_dict = {'media': []}

    our_manifest_dict = generate_manifest_dict(project, resources)
    our_res_dict = our_manifest_dict['resources']

    if our_res_dict != their_res_dict:
        print "Resources mismatch."
        has_changed = True
        # Try removing things that we've deleted, if any
        to_remove = set(x['file'] for x in their_res_dict['media']) - set(x['file'] for x in our_res_dict['media'])
        for path in to_remove:
            repo_path = resource_root + path
            if repo_path in next_tree:
                print "Deleted resource: %s" % repo_path
                del next_tree[repo_path]

    # This one is separate because there's more than just the resource map changing.
    if their_manifest_dict != our_manifest_dict:
        has_changed = True
        if remote_manifest_path in next_tree:
            next_tree[remote_manifest_path]._InputGitTreeElement__sha = NotSet
            next_tree[remote_manifest_path]._InputGitTreeElement__content = generate_manifest(project, resources)
        else:
            next_tree[remote_manifest_path] = InputGitTreeElement(path=remote_manifest_path, mode='100644', type='blob',
                                                                  content=generate_manifest(project, resources))

    if project.project_type == 'native' and remote_wscript_path not in next_tree:
        next_tree[remote_wscript_path] = InputGitTreeElement(path=remote_wscript_path, mode='100644', type='blob',
                                                             content=generate_wscript_file(project, True))
        has_changed = True

    # Commit the new tree.
    if has_changed:
        print "Has changed; committing"
        # GitHub seems to choke if we pass the raw directory nodes off to it,
        # so we delete those.
        for x in next_tree.keys():
            if next_tree[x]._InputGitTreeElement__mode == '040000':
                del next_tree[x]
                print "removing subtree node %s" % x

        print [x._InputGitTreeElement__mode for x in next_tree.values()]
        git_tree = repo.create_git_tree(next_tree.values())
        print "Created tree %s" % git_tree.sha
        git_commit = repo.create_git_commit(commit_message, git_tree, [commit])
        print "Created commit %s" % git_commit.sha
        git_ref = repo.get_git_ref('heads/%s' % (project.github_branch or repo.master_branch))
        git_ref.edit(git_commit.sha)
        print "Updated ref %s" % git_ref.ref
        project.github_last_commit = git_commit.sha
        project.github_last_sync = now()
        project.save()
        return True

    send_td_event('cloudpebble_github_push', data={
        'data': {
            'repo': project.github_repo
        }
    }, user=user)

    return False


def get_root_path(path):
    path, extension = os.path.splitext(path)
    return path.split('~', 1)[0] + extension


@git_auth_check
def github_pull(user, project):
    g = get_github(user)
    repo_name = project.github_repo
    if repo_name is None:
        raise Exception("No GitHub repo defined.")
    repo = g.get_repo(repo_name)
    # If somehow we don't have a branch set, this will use the "master_branch"
    branch_name = project.github_branch or repo.master_branch
    try:
        branch = repo.get_branch(branch_name)
    except GithubException:
        raise Exception("Unable to get the branch.")

    if project.github_last_commit == branch.commit.sha:
        # Nothing to do.
        return False

    commit = repo.get_git_commit(branch.commit.sha)
    tree = repo.get_git_tree(commit.tree.sha, recursive=True)

    paths = {x.path: x for x in tree.tree}
    paths_notags = {get_root_path(x) for x in paths}
    root = find_project_root(paths)

    # First try finding the resource map so we don't fail out part-done later.
    # TODO: transaction support for file contents would be nice...

    resource_root = root + 'resources/'
    manifest_path = root + 'appinfo.json'
    if manifest_path in paths:
        manifest_sha = paths[manifest_path].sha
        manifest = json.loads(git_blob(repo, manifest_sha))
        media = manifest.get('resources', {}).get('media', [])
    else:
        raise Exception("appinfo.json not found")

    project_type = manifest.get('projectType', 'native')

    for resource in media:
        path = resource_root + resource['file']
        if project_type == 'pebblejs' and resource['name'] in {
                'MONO_FONT_14', 'IMAGE_MENU_ICON', 'IMAGE_LOGO_SPLASH', 'IMAGE_TILE_SPLASH'}:
            continue
        if path not in paths_notags:
            raise Exception("Resource %s not found in repo." % path)

    # Now we grab the zip.
    zip_url = repo.get_archive_link('zipball', branch_name)
    u = urllib2.urlopen(zip_url)

    # And wipe the project!
    project.source_files.all().delete()
    project.resources.all().delete()

    # This must happen before do_import_archive or we'll stamp on its results.
    project.github_last_commit = branch.commit.sha
    project.github_last_sync = now()
    project.save()

    import_result = do_import_archive(project.id, u.read())

    send_td_event('cloudpebble_github_pull', data={
        'data': {
            'repo': project.github_repo
        }
    }, user=user)

    return import_result


@task
def do_github_push(project_id, commit_message):
    project = Project.objects.select_related('owner__github').get(pk=project_id)
    return github_push(project.owner, commit_message, project.github_repo, project)


@task
def do_github_pull(project_id):
    project = Project.objects.select_related('owner__github').get(pk=project_id)
    return github_pull(project.owner, project)


@task
def hooked_commit(project_id, target_commit):
    project = Project.objects.select_related('owner__github').get(pk=project_id)
    did_something = False
    print "Comparing %s versus %s" % (project.github_last_commit, target_commit)
    if project.github_last_commit != target_commit:
        github_pull(project.owner, project)
        did_something = True

    if project.github_hook_build:
        build = BuildResult.objects.create(project=project)
        run_compile(build.id)
        did_something = True

    return did_something
