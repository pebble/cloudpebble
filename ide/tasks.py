from celery import task

from ide.models import Project, SourceFile, ResourceFile, ResourceIdentifier, BuildResult
from ide.git import git_auth_check, get_github
from django.utils import simplejson as json
from django.utils.timezone import now
from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from django.db import transaction


import tempfile
import os
import os.path
import subprocess
import shutil
import zipfile
import uuid
import urllib2
import re
import hashlib
from github import Github, BadCredentialsException
from github.InputGitTreeElement import InputGitTreeElement
from github.GithubObject import NotSet
import base64
import traceback


def create_sdk_symlinks(project_root, sdk_root):
    SDK_LINKS = ["waf", "wscript", "tools", "lib", "pebble_app.ld", "include"]

    for item_name in SDK_LINKS:
        os.symlink(os.path.join(sdk_root, item_name), os.path.join(project_root, item_name))

    os.symlink(os.path.join(sdk_root, os.path.join("resources", "wscript")),
               os.path.join(project_root, os.path.join("resources", "wscript")))


@task(ignore_result=True, acks_late=True)
def run_compile(build_result):
    build_result = BuildResult.objects.get(pk=build_result)
    project = build_result.project
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)

    # Assemble the project somewhere
    base_dir = tempfile.mkdtemp(dir=os.path.join(settings.CHROOT_ROOT, 'tmp') if settings.CHROOT_ROOT else None)
    print "Compiling in %s" % base_dir

    try:
        os.makedirs(build_result.get_dir())
    except OSError:
        pass

    try:
        # Create symbolic links to the original files
        # Source code
        src_dir = os.path.join(base_dir, 'src')
        os.mkdir(src_dir)
        for f in source_files:
            abs_target = os.path.abspath(os.path.join(src_dir, f.file_name))
            if not abs_target.startswith(src_dir):
                raise Exception("Suspicious filename: %s" % f.file_name)
            os.link(os.path.abspath(f.local_filename), abs_target)

        # Resources
        os.makedirs(os.path.join(base_dir, 'resources/src/images'))
        os.makedirs(os.path.join(base_dir, 'resources/src/fonts'))
        os.makedirs(os.path.join(base_dir, 'resources/src/data'))
        resource_map = {'friendlyVersion': 'VERSION', 'versionDefName': project.version_def_name, 'media': []}
        if len(resources) == 0:
            print "No resources; adding dummy."
            resource_map['media'].append({"type": "raw", "defName": "DUMMY", "file": "resource_map.json"})
        else:
            for f in resources:
                target_dir = os.path.abspath(os.path.join(base_dir, 'resources/src', ResourceFile.DIR_MAP[f.kind]))
                abs_target = os.path.abspath(os.path.join(target_dir, f.file_name))
                if not abs_target.startswith(target_dir):
                    raise Exception("Suspicious filename: %s" % f.file_name)
                print "Added %s %s" % (f.kind, f.local_filename)
                os.link(os.path.abspath(f.local_filename), abs_target)
                for resource_id in f.get_identifiers():
                    d = {
                        'type': f.kind,
                        'defName': resource_id.resource_id,
                        'file': f.path
                    }
                    if resource_id.character_regex:
                        d['characterRegex'] = resource_id.character_regex
                    if resource_id.tracking:
                        d['trackingAdjust'] = resource_id.tracking
                    resource_map['media'].append(d)

        # Write out the resource map
        print "Writing out resource map"
        open(os.path.join(base_dir, 'resources/src/resource_map.json'), 'w').write(json.dumps(resource_map))

        # Reconstitute the SDK
        print "Symlinking SDK"
        create_sdk_symlinks(base_dir, os.path.abspath("pebble-sdk/sdk" if settings.CHROOT_JAIL is None else "/sdk/sdk"))

        # Build the thing
        print "Beginning compile"
        cwd = os.getcwd()
        success = False
        try:
            if settings.CHROOT_JAIL is not None:
                output = subprocess.check_output([settings.CHROOT_JAIL, base_dir[len(settings.CHROOT_ROOT):]], stderr=subprocess.STDOUT)
            else:
                os.environ['PATH'] += ':/Users/katharine/projects/cloudpebble/pebble-sdk/arm-cs-tools/bin'
                os.chdir(base_dir)
                subprocess.check_output(["./waf", "configure"], stderr=subprocess.STDOUT)
                output = subprocess.check_output(["./waf", "build"], stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as e:
            output = e.output
            success = False
        else:
            success = True
            temp_file = os.path.join(base_dir, 'build', '%s.pbw' % os.path.basename(base_dir))
        finally:
            os.chdir(cwd)

            if success:
                os.rename(temp_file, build_result.pbw)
                print "Build succeeded."
            else:
                print "Build failed."
            open(build_result.build_log, 'w').write(output)
            build_result.state = BuildResult.STATE_SUCCEEDED if success else BuildResult.STATE_FAILED
            build_result.finished = now()
            build_result.save()
    except Exception as e:
        print "Build failed due to internal error: %s" % e
        traceback.print_exc()
        build_result.state = BuildResult.STATE_FAILED
        build_result.finished = now()
        try:
            open(build_result.build_log, 'w').write("Something broke:\n%s" % e)
        except:
            pass
        build_result.save()
    finally:
        print "Removing temporary directory"
        shutil.rmtree(base_dir)


def generate_resource_dict(project, resources):
    resource_map = {'friendlyVersion': 'VERSION', 'versionDefName': project.version_def_name, 'media': []}
    if len(resources) == 0:
        print "No resources; adding dummy."
        resource_map['media'].append({"type": "raw", "defName": "DUMMY", "file": "resource_map.json"})
    else:
        for resource in resources:
            for resource_id in resource.get_identifiers():
                d = {
                    'type': resource.kind,
                    'defName': resource_id.resource_id,
                    'file': resource.path
                }
                if resource_id.character_regex:
                    d['characterRegex'] = resource_id.character_regex
                if resource_id.tracking:
                    d['trackingAdjust'] = resource_id.tracking
                resource_map['media'].append(d)
    return resource_map


def resource_dict_to_json(d):
    return json.dumps(d, indent=4, separators=(',', ': ')) + "\n"


def generate_resource_map(project, resources):
    return resource_dict_to_json(generate_resource_dict(project, resources))


@task(acks_late=True)
def create_archive(project_id):
    project = Project.objects.get(pk=project_id)
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    prefix = re.sub(r'[^\w]+', '_', project.name).strip('_').lower()
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp:
        filename = temp.name
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for source in source_files:
                z.writestr('%s/src/%s' % (prefix, source.file_name), source.get_contents())

            for resource in resources:
                z.writestr('%s/resources/src/%s' % (prefix, resource.path), open(resource.local_filename).read())

            resource_map = generate_resource_map(project, resources)

            z.writestr('%s/resources/src/resource_map.json' % prefix, resource_map)

        # Generate a URL
        u = uuid.uuid4().hex
        outfile = '%s%s/%s.zip' % (settings.EXPORT_DIRECTORY, u, prefix)
        os.makedirs(os.path.dirname(outfile), 0755)
        shutil.copy(filename, outfile)
        os.chmod(outfile, 0644)
        return '%s%s/%s.zip' % (settings.EXPORT_ROOT, u, prefix)


class NoProjectFoundError(Exception):
    pass


def find_project_root(contents):
    RESOURCE_MAP = 'resources/src/resource_map.json'
    SRC_DIR = 'src/'
    for base_dir in contents:
        try:
            dir_end = base_dir.index(RESOURCE_MAP)
        except ValueError:
            continue
        else:
            if dir_end + len(RESOURCE_MAP) != len(base_dir):
                continue
        base_dir = base_dir[:dir_end]
        for source_dir in contents:
            if source_dir[:dir_end] != base_dir:
                continue
            if source_dir[-2:] != '.c':
                continue
            if source_dir[dir_end:dir_end+len(SRC_DIR)] != SRC_DIR:
                continue
            break
        else:
            continue
        break
    else:
        raise Exception("No project root found.")
    return base_dir


@task(acks_late=True)
def do_import_archive(project_id, archive_location, delete_zip=False, delete_project=False):
    try:
        project = Project.objects.get(pk=project_id)
        # archive_location *must not* be a file-like object. We ensure this by string casting.
        archive_location = str(archive_location)
        if not zipfile.is_zipfile(archive_location):
            raise NoProjectFoundError("The file is not a zip file.")

        with zipfile.ZipFile(str(archive_location), 'r') as z:
            contents = z.infolist()
            # Requirements:
            # - Find the folder containing the project. This may or may not be at the root level.
            # - Read in the source files, resources and resource map.
            # Observations:
            # - Legal projects must keep their source in a directory called 'src' containing at least one *.c file.
            # - Legal projects must have a resource map at resources/src/resource_map.json
            # Strategy:
            # - Find the shortest common prefix for 'resources/src/resource_map.json' and 'src/'.
            #   - This is taken to be the project directory.
            # - Import every file in 'src/' with the extension .c or .h as a source file
            # - Parse resource_map.json and import files it references
            RESOURCE_MAP = 'resources/src/resource_map.json'
            SRC_DIR = 'src/'
            if len(contents) > 200:
                raise Exception("Too many files in zip file.")
            file_list = [x.filename for x in contents]

            base_dir = find_project_root(file_list)
            dir_end = len(base_dir)

            # Now iterate over the things we found
            with transaction.commit_on_success():
                for entry in contents:
                    filename = entry.filename
                    if filename[:dir_end] != base_dir:
                        continue
                    filename = filename[dir_end:]
                    if filename == '':
                        continue
                    if not os.path.normpath('/SENTINEL_DO_NOT_ACTUALLY_USE_THIS_NAME/%s' % filename).startswith('/SENTINEL_DO_NOT_ACTUALLY_USE_THIS_NAME/'):
                        raise SuspiciousOperation("Invalid zip file contents.")
                    if entry.file_size > 5242880:  # 5 MB
                        raise Exception("Excessively large compressed file.")

                    if filename == RESOURCE_MAP:
                        # We have a resource map! We can now try importing things from it.
                        with z.open(entry) as f:
                            m = json.loads(f.read())
                        project.version_def_name = m['versionDefName']
                        resources = {}
                        for resource in m['media']:
                            kind = resource['type']
                            def_name = resource['defName']
                            file_name = resource['file']
                            regex = resource.get('characterRegex', None)
                            tracking = resource.get('trackingAdjust', None)
                            if file_name not in resources:
                                resources[file_name] = ResourceFile.objects.create(project=project, file_name=os.path.basename(file_name), kind=kind)
                                local_filename = resources[file_name].get_local_filename(create=True)
                                open(local_filename, 'w').write(z.open('%sresources/src/%s' % (base_dir, file_name)).read())
                            ResourceIdentifier.objects.create(resource_file=resources[file_name], resource_id=def_name, character_regex=regex, tracking=tracking)

                    elif filename.startswith(SRC_DIR):
                        if (not filename.startswith('.')) and (filename.endswith('.c') or filename.endswith('.h')):
                            source = SourceFile.objects.create(project=project, file_name=os.path.basename(filename))
                            with z.open(entry.filename) as f:
                                source.save_file(f.read().decode('utf-8'))
                project.save()

        # At this point we're supposed to have successfully created the project.
        if delete_zip:
            try:
                os.unlink(archive_location)
            except OSError:
                print "Unable to remove archive at %s." % archive_location
        return True
    except:
        if delete_project:
            try:
                Project.objects.get(pk=project_id).delete()
            except:
                pass
        raise


@task(acks_late=True)
def do_import_github(project_id, github_user, github_project, delete_project=False):
    try:
        url = "https://github.com/%s/%s/archive/master.zip" % (github_user, github_project)
        u = urllib2.urlopen(url)
        with tempfile.NamedTemporaryFile(suffix='.zip') as temp:
            shutil.copyfileobj(u, temp)
            temp.flush()
            return do_import_archive(project_id, temp.name)
    except:
        if delete_project:
            try:
                Project.objects.get(pk=project_id).delete()
            except:
                pass
        raise


def git_sha(content):
    return hashlib.sha1('blob %d\x00%s' % (len(content), content)).hexdigest()


def git_blob(repo, sha):
    return base64.b64decode(repo.get_git_blob(sha).content)


@git_auth_check
def github_push(user, commit_message, repo_name, project):
    g = Github(user.github.token, client_id=settings.GITHUB_CLIENT_ID, client_secret=settings.GITHUB_CLIENT_SECRET)
    repo = g.get_repo(repo_name)
    branch = repo.get_branch(repo.master_branch)
    commit = repo.get_git_commit(branch.commit.sha)
    tree = repo.get_git_tree(commit.tree.sha, recursive=True)

    paths = [x.path for x in tree.tree]

    next_tree = {x.path: InputGitTreeElement(path=x.path, mode=x.mode, type=x.type, sha=x.sha) for x in tree.tree}

    try:
        root = find_project_root(paths)
    except:
        root = ''

    src_root = root + 'src/'
    project_sources = project.source_files.all()
    has_changed = False
    for source in project_sources:
        repo_path = src_root + source.file_name
        if repo_path not in next_tree:
            has_changed = True
            next_tree[repo_path] = InputGitTreeElement(path=repo_path, mode='100644', type='blob', content=source.get_contents())
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

    expected_source_files = [src_root + x.file_name for x in project_sources]
    for path in next_tree.keys():
        if not path.startswith(src_root):
            continue
        if path not in expected_source_files:
            del next_tree[path]
            print "Deleted file: %s" % path
            has_changed = True

    # Now try handling resource files.
    resources = project.resources.all()
    remote_map_path = root + 'resources/src/resource_map.json'
    remote_map_sha = next_tree[remote_map_path]._InputGitTreeElement__sha if remote_map_path in next_tree else None

    resource_root = root + "resources/src/"
    for res in resources:
        repo_path = resource_root + res.path
        if repo_path in next_tree:
            content = res.get_contents()
            if git_sha(content) != next_tree[repo_path]._InputGitTreeElement__sha:
                print "Changed resource: %s" % repo_path
                has_changed = True
                blob = repo.create_git_blob(base64.b64encode(content), 'base64')
                print "Created blob %s" % blob.sha
                next_tree[repo_path]._InputGitTreeElement__sha = blob.sha
        else:
            print "New resource: %s" % repo_path
            blob = repo.create_git_blob(base64.b64encode(res.get_contents()), 'base64')
            print "Created blob %s" % blob.sha
            next_tree[repo_path] = InputGitTreeElement(path=repo_path, mode='100644', type='blob', sha=blob.sha)

    our_res_dict = generate_resource_dict(project, resources)
    if remote_map_sha is not None:
        their_res_dict = json.loads(git_blob(repo, remote_map_sha))
    else:
        their_res_dict = {'friendlyVersion': 'VERSION', 'versionDefName': '', 'media': []}
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

        if remote_map_path in next_tree:
            next_tree[remote_map_path]._InputGitTreeElement__sha = NotSet
            next_tree[remote_map_path]._InputGitTreeElement__content = resource_dict_to_json(our_res_dict)
        else:
            next_tree[remote_map_path] = InputGitTreeElement(path=remote_map_path, mode='100644', type='blob', content=resource_dict_to_json(our_res_dict))

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
        git_ref = repo.get_git_ref('heads/%s' % repo.master_branch)
        git_ref.edit(git_commit.sha)
        print "Updated ref %s" % git_ref.ref
        project.github_last_commit = git_commit.sha
        project.github_last_sync = now()
        project.save()
        return True

    return False


@git_auth_check
def github_pull(user, project):
    g = get_github(user)
    repo_name = project.github_repo
    if repo_name is None:
        raise Exception("No GitHub repo defined.")
    repo = g.get_repo(repo_name)
    branch = repo.get_branch(repo.master_branch)

    if project.github_last_commit == branch.commit.sha:
        # Nothing to do.
        return False

    commit = repo.get_git_commit(branch.commit.sha)
    tree = repo.get_git_tree(commit.tree.sha, recursive=True)

    paths = {x.path: x for x in tree.tree}

    root = find_project_root(paths)

    # First try finding the resource map so we don't fail out part-done later.
    # TODO: transaction support for file contents would be nice...
    resource_root = root + 'resources/src/'
    remote_map_path = resource_root + 'resource_map.json'
    if remote_map_path not in paths:
        raise Exception("resource_map.json not found.")
    remote_map_sha = paths[remote_map_path].sha
    remote_map = json.loads(git_blob(repo, remote_map_sha))

    for resource in remote_map['media']:
        path = resource_root + resource['file']
        if path not in paths:
            raise Exception("Resource %s not found in repo." % path)

    # Now we grab the zip.
    zip_url = repo.get_archive_link('zipball', repo.master_branch)
    u = urllib2.urlopen(zip_url)
    with tempfile.NamedTemporaryFile(suffix='.zip') as temp:
        shutil.copyfileobj(u, temp)
        temp.flush()
        # And wipe the project!
        project.source_files.all().delete()
        project.resources.all().delete()
        import_result = do_import_archive(project.id, temp.name)
        project.github_last_commit = branch.commit.sha
        project.github_last_sync = now()
        project.save()
        return import_result


@task
def do_github_push(project_id, commit_message):
    project = Project.objects.select_related('owner__github').get(pk=project_id)
    return github_push(project.owner, commit_message, project.github_repo, project)


@task
def do_github_pull(project_id):
    project = Project.objects.select_related('owner__github').get(pk=project_id)
    return github_pull(project.owner, project)
