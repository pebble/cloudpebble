import logging
import os
import resource
import shutil
import subprocess
import tempfile
import zipfile

from celery import task
from django.conf import settings
from django.utils.timezone import now

import apptools.addr2lines
from ide.models.build import BuildResult, BuildSize
from ide.models.dependency import validate_dependency_version
from ide.utils.sdk.project_assembly import assemble_project
from utils.td_helper import send_td_event

__author__ = 'katharine'

logger = logging.getLogger(__name__)


def _set_resource_limits():
    resource.setrlimit(resource.RLIMIT_CPU, (120, 120))  # 120 seconds of CPU time
    resource.setrlimit(resource.RLIMIT_NOFILE, (500, 500))  # 500 open files
    resource.setrlimit(resource.RLIMIT_RSS, (30 * 1024 * 1024, 30 * 1024 * 1024))  # 30 MB of memory
    resource.setrlimit(resource.RLIMIT_FSIZE, (20 * 1024 * 1024, 20 * 1024 * 1024))  # 20 MB output files.

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

    # Assemble the project somewhere
    base_dir = tempfile.mkdtemp(dir=os.path.join(settings.CHROOT_ROOT, 'tmp') if settings.CHROOT_ROOT else None)

    try:
        assemble_project(project, base_dir, build_result)
        # Build the thing
        cwd = os.getcwd()
        success = False
        output = ''
        build_start_time = now()

        try:
            os.chdir(base_dir)

            environ = os.environ.copy()
            environ.update({
                'LD_PRELOAD': settings.C_PRELOAD_ROOT + 'libpreload.so',
                'ALLOWED_FOR_CREATE': '/tmp',
                'ALLOWED_FOR_READ': '/usr/local/include:/usr/include:/usr/lib:/lib:/lib64:/tmp' \
                                    ':/dev/urandom:/proc/self:/proc/self/maps:/proc/mounts' \
                                    ':/app/.heroku:/app/sdk2:/app/sdk3:/app/arm-cs-tools',
                'PATH': '{}:{}'.format(settings.ARM_CS_TOOLS, environ['PATH']),
                'HOME': '/app'
            })

            # Install dependencies if there are any
            dependencies = project.get_dependencies()
            if dependencies:
                # Checking for path-based dependencies is performed by the database so in theory we shouldn't need to do
                # it here but we will do it anyway just to be extra safe.
                for version in dependencies.values():
                    validate_dependency_version(version)
                npm_command = [settings.NPM_BINARY, "install", "--ignore-scripts", "--no-bin-links"]
                output = subprocess.check_output(npm_command, stderr=subprocess.STDOUT, preexec_fn=_set_resource_limits, env=environ)
                subprocess.check_output([settings.NPM_BINARY, "dedupe"], stderr=subprocess.STDOUT, preexec_fn=_set_resource_limits, env=environ)

            if project.sdk_version == '2':
                command = [settings.SDK2_PEBBLE_WAF, "configure", "build"]
            elif project.sdk_version == '3':
                if settings.WAF_NODE_PATH:
                    environ['NODE_PATH'] = settings.WAF_NODE_PATH
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
            if project.project_type == 'package':
                temp_file = os.path.join(base_dir, 'dist.zip')
            else:
                temp_file = os.path.join(base_dir, 'build', '%s.pbw' % os.path.basename(base_dir))
            if not os.path.exists(temp_file):
                success = False
                logger.warning("Success was a lie.")
        finally:
            build_end_time = now()
            os.chdir(cwd)

            if success:
                # Try reading file sizes out of it first.
                if project.project_type != 'package':
                    try:
                        s = os.stat(temp_file)
                        build_result.total_size = s.st_size
                        # Now peek into the zip to see the component parts
                        with zipfile.ZipFile(temp_file, 'r') as z:
                            for platform in ['aplite', 'basalt', 'chalk', 'diorite', 'emery']:
                                store_size_info(project, build_result, platform, z)

                    except Exception as e:
                        logger.warning("Couldn't extract filesizes: %s", e)

                    # Try pulling out debug information.
                    if project.sdk_version == '2':
                        save_debug_info(base_dir, build_result, BuildResult.DEBUG_APP, 'aplite', os.path.join(base_dir, 'build', 'pebble-app.elf'))
                        save_debug_info(base_dir, build_result, BuildResult.DEBUG_WORKER, 'aplite', os.path.join(base_dir, 'build', 'pebble-worker.elf'))
                    else:
                        for platform in ['aplite', 'basalt', 'chalk', 'diorite', 'emery']:
                            save_debug_info(base_dir, build_result, BuildResult.DEBUG_APP, platform, os.path.join(base_dir, 'build', '%s/pebble-app.elf' % platform))
                            save_debug_info(base_dir, build_result, BuildResult.DEBUG_WORKER, platform, os.path.join(base_dir, 'build', '%s/pebble-worker.elf' % platform))

                    build_result.save_pbw(temp_file)
                else:
                    # tar.gz up the entire built project directory as the build result.
                    archive = shutil.make_archive(os.path.join(base_dir, "package"), 'gztar', base_dir)
                    build_result.save_package(archive)

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
