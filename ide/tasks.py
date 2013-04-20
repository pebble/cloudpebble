from celery import task

from ide.models import Project, SourceFile, ResourceFile, ResourceIdentifier, BuildResult
from django.utils import simplejson as json
from django.utils.timezone import now

import tempfile
import os
import os.path
import subprocess
import shutil

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
    base_dir = tempfile.mkdtemp()
    print "Compiling in %s" % base_dir
    try:
        # Create symbolic links to the original files
        # Source code
        src_dir = os.path.join(base_dir, 'src')
        os.mkdir(src_dir)
        for f in source_files:
            os.symlink(os.path.abspath(f.local_filename), os.path.join(src_dir, f.file_name))

        # Resources
        os.makedirs(os.path.join(base_dir, 'resources/src/images'))
        os.makedirs(os.path.join(base_dir, 'resources/src/fonts'))
        os.makedirs(os.path.join(base_dir, 'resources/src/data'))
        mapping = {
            'png': 'images',
            'png-trans': 'images',
            'font': 'fonts',
            'blob': 'data'
        }
        resource_map = {'friendlyVersion': 'VERSION', 'versionDefName': 'APP_RESOURCES', 'media': []}
        if len(resources) == 0:
            print "No resources; adding dummy."
            resource_map['media'].append({"type":"raw","defName":"DUMMY","file":"resource_map.json"})
        else:
            for f in resources:
                print "Added %s %s" % (f.kind, f.local_filename)
                os.symlink(os.path.abspath(f.local_filename), os.path.join(base_dir, 'resources/src', mapping[f.kind], f.file_name))
                for resource_id in f.get_identifiers():
                    d = {
                        'type': f.kind,
                        'defName': resource_id.resource_id,
                        'file': os.path.join(mapping[f.kind], f.file_name)
                    }
                    if resource_id.character_regex:
                        d['characterRegex'] = resource_id.character_regex
                    resource_map['media'].append(d)

        # Write out the resource map
        print "Writing out resource map"
        open(os.path.join(base_dir, 'resources/src/resource_map.json'), 'w').write(json.dumps(resource_map))

        # Reconstitute the SDK
        print "Symlinking SDK"
        create_sdk_symlinks(base_dir, os.path.abspath("pebble-sdk/sdk"))

        # Build the thing
        print "Beginning compile"
        os.environ['PATH'] += ':/Users/katharine/projects/cloudpebble/pebble-sdk/arm-cs-tools/bin'
        cwd = os.getcwd()
        success = False
        try:
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
            try:
                os.makedirs(build_result.get_dir())
            except OSError:
                pass

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