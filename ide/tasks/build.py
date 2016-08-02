import os
import shutil
import subprocess
import tempfile
import zipfile
import json
import resource
import logging

from celery import task

from django.conf import settings
from django.utils.timezone import now

import apptools.addr2lines
from ide.utils.sdk import generate_wscript_file, generate_jshint_file, generate_manifest_dict, \
    generate_simplyjs_manifest_dict, generate_pebblejs_manifest_dict, manifest_name_for_project
from utils.td_helper import send_td_event

from ide.models.build import BuildResult, BuildSize
from ide.models.files import SourceFile, ResourceFile, ResourceVariant
from ide.utils.prepreprocessor import process_file as check_preprocessor_directives
from ide.models.dependency import validate_dependency_version

__author__ = 'katharine'

logger = logging.getLogger(__name__)


def _set_resource_limits():
    resource.setrlimit(resource.RLIMIT_CPU, (120, 120)) # 120 seconds of CPU time
    resource.setrlimit(resource.RLIMIT_NOFILE, (500, 500)) # 500 open files
    resource.setrlimit(resource.RLIMIT_RSS, (30 * 1024 * 1024, 30 * 1024 * 1024)) # 30 MB of memory
    resource.setrlimit(resource.RLIMIT_FSIZE, (20 * 1024 * 1024, 20 * 1024 * 1024)) # 20 MB output files.


def create_source_files(project, base_dir):
    """
    :param project: Project
    """
    source_files = project.source_files.all()
    src_dir = os.path.join(base_dir, 'src')
    if project.project_type == 'pebblejs':
        src_dir = os.path.join(src_dir, 'js')
    worker_dir = None
    try:
        os.mkdir(src_dir)
    except OSError as e:
        if e.errno == 17:  # file exists
            pass
        else:
            raise
    for f in source_files:
        target_dir = src_dir
        if project.project_type == 'native':
            if f.target == 'worker':
                if worker_dir is None:
                    worker_dir = os.path.join(base_dir, 'worker_src')
                    os.mkdir(worker_dir)
                target_dir = worker_dir
            elif f.file_name.endswith('.js'):
                target_dir = os.path.join(target_dir, 'js')

        abs_target = os.path.abspath(os.path.join(target_dir, f.file_name))
        if not abs_target.startswith(target_dir):
            raise Exception("Suspicious filename: %s" % f.file_name)
        abs_target_dir = os.path.dirname(abs_target)
        if not os.path.exists(abs_target_dir):
            os.makedirs(abs_target_dir)
        f.copy_to_path(abs_target)
        # Make sure we don't duplicate downloading effort; just open the one we created.
        with open(abs_target) as fh:
            check_preprocessor_directives(abs_target_dir, abs_target, fh.read())


def save_debug_info(base_dir, build_result, kind, platform, elf_file):
    path = os.path.join(base_dir, 'build', elf_file)
    if os.path.exists(path):
        try:
            debug_info = apptools.addr2lines.create_coalesced_group(path)
        except:
            # This will print the traceback
            logger.exception("Failed to save debug info.")
        else:
            build_result.save_debug_info(debug_info, platform, kind)


def store_size_info(project, build_result, platform, zip_file):
    platform_dir = platform + '/'
    if platform == 'aplite' and project.sdk_version == '2':
        platform_dir = ''
    try:
        build_size = BuildSize.objects.create(
            build=build_result,
            binary_size=zip_file.getinfo(platform_dir + 'pebble-app.bin').file_size,
            resource_size=zip_file.getinfo(platform_dir + 'app_resources.pbpack').file_size,
            platform=platform,
        )
        try:
            build_size.worker_size = zip_file.getinfo(platform_dir + 'pebble-worker.bin').file_size
        except KeyError:
            pass
        build_size.save()
    except KeyError:
        pass


@task(ignore_result=True, acks_late=True)
def run_compile(build_result):
    build_result = BuildResult.objects.get(pk=build_result)
    project = build_result.project
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)

    # Assemble the project somewhere
    base_dir = tempfile.mkdtemp(dir=os.path.join(settings.CHROOT_ROOT, 'tmp') if settings.CHROOT_ROOT else None)

    manifest_filename = manifest_name_for_project(project)
    try:
        # Resources
        resource_root = 'resources'
        os.makedirs(os.path.join(base_dir, resource_root, 'images'))
        os.makedirs(os.path.join(base_dir, resource_root, 'fonts'))
        os.makedirs(os.path.join(base_dir, resource_root, 'data'))

        if project.project_type == 'native':
            # Source code
            create_source_files(project, base_dir)

            manifest_dict = generate_manifest_dict(project, resources)
            open(os.path.join(base_dir, manifest_filename), 'w').write(json.dumps(manifest_dict))

            for f in resources:
                target_dir = os.path.abspath(os.path.join(base_dir, resource_root, ResourceFile.DIR_MAP[f.kind]))
                abs_target = os.path.abspath(os.path.join(target_dir, f.file_name))
                f.copy_all_variants_to_dir(target_dir)

            # Reconstitute the SDK
            open(os.path.join(base_dir, 'wscript'), 'w').write(generate_wscript_file(project))
            open(os.path.join(base_dir, 'pebble-jshintrc'), 'w').write(generate_jshint_file(project))
        elif project.project_type == 'simplyjs':
            shutil.rmtree(base_dir)
            shutil.copytree(settings.SIMPLYJS_ROOT, base_dir)
            manifest_dict = generate_simplyjs_manifest_dict(project)

            js = '\n\n'.join(x.get_contents() for x in source_files if x.file_name.endswith('.js'))
            escaped_js = json.dumps(js)
            build_result.save_simplyjs(js)

            open(os.path.join(base_dir, manifest_filename), 'w').write(json.dumps(manifest_dict))
            open(os.path.join(base_dir, 'src', 'js', 'zzz_userscript.js'), 'w').write("""
            (function() {
                simply.mainScriptSource = %s;
            })();
            """ % escaped_js)
        elif project.project_type == 'pebblejs':
            shutil.rmtree(base_dir)
            shutil.copytree(settings.PEBBLEJS_ROOT, base_dir)
            manifest_dict = generate_pebblejs_manifest_dict(project, resources)
            create_source_files(project, base_dir)

            for f in resources:
                if f.kind not in ('png', 'bitmap'):
                    continue
                target_dir = os.path.abspath(os.path.join(base_dir, resource_root, ResourceFile.DIR_MAP[f.kind]))
                f.copy_all_variants_to_dir(target_dir)

            open(os.path.join(base_dir, manifest_filename), 'w').write(json.dumps(manifest_dict))

        # Build the thing
        cwd = os.getcwd()
        success = False
        output = ''
        build_start_time = now()

        try:
            os.chdir(base_dir)

            # Install dependencies if there are any
            dependencies = project.get_dependencies()
            if dependencies:
                # Checking for path-based dependencies is performed by the database so in theory we shouldn't need to do
                # it here but we will do it anyway just to be extra safe.
                for version in dependencies.values():
                    validate_dependency_version(version)
                npm_command = [settings.NPM_BINARY, "install", "--ignore-scripts"]
                output = subprocess.check_output(npm_command, stderr=subprocess.STDOUT, preexec_fn=_set_resource_limits)
                subprocess.check_output([settings.NPM_BINARY, "dedupe"], stderr=subprocess.STDOUT, preexec_fn=_set_resource_limits)

            if project.sdk_version == '2':
                environ = os.environ.copy()
                environ['PATH'] = '{}:{}'.format(settings.ARM_CS_TOOLS, environ['PATH'])
                command = [settings.SDK2_PEBBLE_WAF, "configure", "build"]
            elif project.sdk_version == '3':
                environ = os.environ.copy()
                environ['PATH'] = '{}:{}'.format(settings.ARM_CS_TOOLS, environ['PATH'])
                command = [settings.SDK3_PEBBLE_WAF, "configure", "build"]
            else:
                raise Exception("invalid sdk version.")

            output += subprocess.check_output(command, stderr=subprocess.STDOUT, preexec_fn=_set_resource_limits,
                                              env=environ)
        except subprocess.CalledProcessError as e:
            output = e.output
            logger.warning("Build command failed with error:\n%s\n", output)
            success = False
        except Exception as e:
            logger.exception("Unexpected exception during build")
            success = False
            output = str(e)
        else:
            success = True
            temp_file = os.path.join(base_dir, 'build', '%s.pbw' % os.path.basename(base_dir))
            if not os.path.exists(temp_file):
                success = False
                logger.warning("Success was a lie.")
        finally:
            build_end_time = now()
            os.chdir(cwd)

            if success:
                # Try reading file sizes out of it first.
                try:
                    s = os.stat(temp_file)
                    build_result.total_size = s.st_size
                    # Now peek into the zip to see the component parts
                    with zipfile.ZipFile(temp_file, 'r') as z:
                        store_size_info(project, build_result, 'aplite', z)
                        store_size_info(project, build_result, 'basalt', z)
                        store_size_info(project, build_result, 'chalk', z)
                        store_size_info(project, build_result, 'diorite', z)

                except Exception as e:
                    logger.warning("Couldn't extract filesizes: %s", e)

                # Try pulling out debug information.
                if project.sdk_version == '2':
                    save_debug_info(base_dir, build_result, BuildResult.DEBUG_APP, 'aplite', os.path.join(base_dir, 'build', 'pebble-app.elf'))
                    save_debug_info(base_dir, build_result, BuildResult.DEBUG_WORKER, 'aplite', os.path.join(base_dir, 'build', 'pebble-worker.elf'))
                else:
                    for platform in ['aplite', 'basalt', 'chalk', 'diorite']:
                        save_debug_info(base_dir, build_result, BuildResult.DEBUG_APP, platform, os.path.join(base_dir, 'build', '%s/pebble-app.elf' % platform))
                        save_debug_info(base_dir, build_result, BuildResult.DEBUG_WORKER, platform, os.path.join(base_dir, 'build', '%s/pebble-worker.elf' % platform))

                build_result.save_pbw(temp_file)
            build_result.save_build_log(output or 'Failed to get output')
            build_result.state = BuildResult.STATE_SUCCEEDED if success else BuildResult.STATE_FAILED
            build_result.finished = now()
            build_result.save()

            data = {
                'data': {
                    'cloudpebble': {
                        'build_id': build_result.id,
                        'job_run_time': (build_result.finished - build_result.started).total_seconds(),
                    },
                    'build_time': (build_end_time - build_start_time).total_seconds(),
                }
            }

            event_name = 'app_build_succeeded' if success else 'app_build_failed'

            send_td_event(event_name, data, project=project)

    except Exception as e:
        logger.exception("Build failed due to internal error: %s", e)
        build_result.state = BuildResult.STATE_FAILED
        build_result.finished = now()
        try:
            build_result.save_build_log("Something broke:\n%s" % e)
        except:
            pass
        build_result.save()
    finally:
        shutil.rmtree(base_dir)
