import os
import shutil
import subprocess
import tempfile
import traceback
import zipfile
import json

from celery import task

from django.conf import settings
from django.utils.timezone import now

import apptools.addr2lines
from ide.utils import link_or_copy
from ide.utils.sdk import generate_wscript_file, generate_jshint_file, generate_v2_manifest_dict, \
    generate_simplyjs_manifest_dict
from utils.keen_helper import send_keen_event

from ide.models.build import  BuildResult
from ide.models.files import SourceFile, ResourceFile

__author__ = 'katharine'


@task(ignore_result=True, acks_late=True)
def run_compile(build_result):
    build_result = BuildResult.objects.get(pk=build_result)
    project = build_result.project
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)

    if project.sdk_version == '1':
        build_result.state = BuildResult.STATE_FAILED
        build_result.finished = now()
        build_result.save()
        return

    # Assemble the project somewhere
    base_dir = tempfile.mkdtemp(dir=os.path.join(settings.CHROOT_ROOT, 'tmp') if settings.CHROOT_ROOT else None)
    print "Compiling in %s" % base_dir

    try:
        os.makedirs(build_result.get_dir())
    except OSError:
        pass

    try:
        if project.project_type == 'native':
            # Create symbolic links to the original files
            # Source code
            src_dir = os.path.join(base_dir, 'src')
            os.mkdir(src_dir)
            for f in source_files:
                abs_target = os.path.abspath(os.path.join(src_dir, f.file_name))
                if not abs_target.startswith(src_dir):
                    raise Exception("Suspicious filename: %s" % f.file_name)
                abs_target_dir = os.path.dirname(abs_target)
                if not os.path.exists(abs_target_dir):
                    print "Creating directory %s." % abs_target_dir
                    os.makedirs(abs_target_dir)
                try:
                    link_or_copy(os.path.abspath(f.local_filename), abs_target)
                except OSError as err:
                    if err.errno == 2:
                        open(abs_target, 'w').close() # create the file if it's missing.

            # Resources
            resource_root = 'resources'
            os.makedirs(os.path.join(base_dir, resource_root, 'images'))
            os.makedirs(os.path.join(base_dir, resource_root, 'fonts'))
            os.makedirs(os.path.join(base_dir, resource_root, 'data'))

            print "Writing out manifest"
            manifest_dict = generate_v2_manifest_dict(project, resources)
            open(os.path.join(base_dir, 'appinfo.json'), 'w').write(json.dumps(manifest_dict))

            for f in resources:
                target_dir = os.path.abspath(os.path.join(base_dir, resource_root, ResourceFile.DIR_MAP[f.kind]))
                abs_target = os.path.abspath(os.path.join(target_dir, f.file_name))
                if not abs_target.startswith(target_dir):
                    raise Exception("Suspicious filename: %s" % f.file_name)
                print "Added %s %s" % (f.kind, f.local_filename)
                link_or_copy(os.path.abspath(f.local_filename), abs_target)


            # Reconstitute the SDK
            print "Inserting wscript"
            open(os.path.join(base_dir, 'wscript'), 'w').write(generate_wscript_file(project))
            print "Inserting jshintrc"
            open(os.path.join(base_dir, 'pebble-jshintrc'), 'w').write(generate_jshint_file(project))
        elif project.project_type == 'simplyjs':
            os.rmdir(base_dir) # This is not intuitive behaviour.
            shutil.copytree(settings.SIMPLYJS_ROOT, base_dir)
            manifest_dict = generate_simplyjs_manifest_dict(project)

            js_path = os.path.join(build_result.get_dir(), 'simply.js')
            js_url = '{0}simply.js'.format(build_result.get_url())

            # We should have exactly one source file, so just dump that in.
            open(js_path, 'w').write(source_files[0].get_contents())

            open(os.path.join(base_dir, 'appinfo.json'), 'w').write(json.dumps(manifest_dict))
            open(os.path.join(base_dir, 'src', 'js', 'zzz_fixurl.js'), 'w').write("""
                Pebble.addEventListener('ready', function() {
                    if(localStorage.getItem('mainJsUrl') != '%(url)s') {
                        simply.loadMainScript('%(url)s');
                    }
                });
            """ % {'url': js_url})

        # Build the thing
        print "Beginning compile"
        cwd = os.getcwd()
        success = False
        output = 'Failed to get output'
        try:
            if settings.CHROOT_JAIL is not None:
                output = subprocess.check_output([settings.CHROOT_JAIL, project.sdk_version, base_dir[len(settings.CHROOT_ROOT):]], stderr=subprocess.STDOUT)
            else:
                os.chdir(base_dir)
                print "Running SDK2 build"
                output = subprocess.check_output(["pebble", "build"], stderr=subprocess.STDOUT)
                print "output", output
        except subprocess.CalledProcessError as e:
            output = e.output
            success = False
        else:
            success = True
            temp_file = os.path.join(base_dir, 'build', '%s.pbw' % os.path.basename(base_dir))
            if not os.path.exists(temp_file):
                success = False
                print "Success was a lie."
        finally:
            os.chdir(cwd)

            if success:
                # Try reading file sizes out of it first.
                try:
                    s = os.stat(temp_file)
                    build_result.total_size = s.st_size
                    # Now peek into the zip to see the component parts
                    with zipfile.ZipFile(temp_file, 'r') as z:
                        build_result.binary_size = z.getinfo('pebble-app.bin').file_size
                        build_result.resource_size = z.getinfo('app_resources.pbpack').file_size
                except Exception as e:
                    print "Couldn't extract filesizes: %s" % e
                # Try pulling out debug information.
                elf_file = os.path.join(base_dir, 'build', 'pebble-app.elf')
                if os.path.exists(elf_file):
                    try:
                        debug_info = apptools.addr2lines.create_coalesced_group(elf_file)
                    except Exception as e:
                        print "Generating debug info failed."
                        print traceback.format_exc()
                    else:
                        json.dump(debug_info, open(build_result.debug_info, 'w'))

                shutil.move(temp_file, build_result.pbw)
                print "Build succeeded."
                send_keen_event(['cloudpebble', 'sdk'], 'app_build_succeeded', data={
                    'data': {
                        'cloudpebble_build_id': build_result.id
                    }
                }, project=project)
            else:
                print "Build failed."
                send_keen_event(['cloudpebble', 'sdk'], 'app_build_failed', data={
                    'data': {
                        'cloudpebble_build_id': build_result.id
                    }
                }, project=project)
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




