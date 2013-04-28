from celery import task

from ide.models import Project, SourceFile, ResourceFile, ResourceIdentifier, BuildResult
from django.utils import simplejson as json
from django.utils.timezone import now
from django.conf import settings


import tempfile
import os
import os.path
import subprocess
import shutil
import zipfile
import uuid

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
                raise Exception, "Suspicious filename: %s" % f.file_name
            os.link(os.path.abspath(f.local_filename), abs_target)

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
        resource_map = {'friendlyVersion': 'VERSION', 'versionDefName': project.version_def_name, 'media': []}
        if len(resources) == 0:
            print "No resources; adding dummy."
            resource_map['media'].append({"type":"raw","defName":"DUMMY","file":"resource_map.json"})
        else:
            for f in resources:
                target_dir = os.path.abspath(os.path.join(base_dir, 'resources/src', mapping[f.kind]))
                abs_target = os.path.abspath(os.path.join(target_dir, f.file_name))
                if not abs_target.startswith(target_dir):
                    raise Exception, "Suspicious filename: %s" % f.file_name
                print "Added %s %s" % (f.kind, f.local_filename)
                os.link(os.path.abspath(f.local_filename), abs_target)
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

@task(acks_late=True)
def create_archive(project_id):
    project = Project.objects.get(pk=project_id)
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    prefix = project.name.replace(' ','_').lower()
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp:
        filename = temp.name
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for source in source_files:
                z.writestr('%s/src/%s' % (prefix, source.file_name), source.get_contents())

            resource_dir_map = {
                'png': 'images',
                'png-trans': 'images',
                'font': 'fonts',
                'blob': 'data'
            }

            resource_map = {'friendlyVersion': 'VERSION', 'versionDefName': project.version_def_name, 'media': []}
            if len(resources) == 0:
                print "No resources; adding dummy."
                resource_map['media'].append({"type":"raw","defName":"DUMMY","file":"resource_map.json"})
            else:
                for resource in resources:
                    z.writestr('%s/resources/src/%s/%s' % (prefix, resource_dir_map[resource.kind], resource.file_name), open(resource.local_filename).read())

                    for resource_id in resource.get_identifiers():
                        d = {
                            'type': resource.kind,
                            'defName': resource_id.resource_id,
                            'file': os.path.join(resource_dir_map[resource.kind], resource.file_name)
                        }
                        if resource_id.character_regex:
                            d['characterRegex'] = resource_id.character_regex
                        resource_map['media'].append(d)


            z.writestr('%s/resources/src/resource_map.json' % prefix, json.dumps(resource_map, indent=4, separators=(',', ': ')))

        # Generate a URL
        u = uuid.uuid4().hex
        outfile = '%s%s/%s.zip' % (settings.EXPORT_DIRECTORY, u, prefix)
        os.makedirs(os.path.dirname(outfile), 0755)
        shutil.copy(filename, outfile)
        os.chmod(outfile, 0644)
        return '%s%s/%s.zip' % (settings.EXPORT_ROOT, u, prefix)
