from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.utils import simplejson as json
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.views.decorators.http import require_safe, require_POST
from django.views.decorators.csrf import csrf_protect
from django.forms import ModelForm
from django.conf import settings

from ide.models import Project, SourceFile, ResourceFile, ResourceIdentifier, BuildResult, TemplateProject
from ide.tasks import run_compile

import uuid

@require_safe
@login_required
def index(request):
    my_projects = Project.objects.filter(owner=request.user).order_by('-last_modified')
    return render(request, 'ide/index.html', {
        'my_projects': my_projects,
        'sdk_templates': TemplateProject.objects.filter(template_kind=TemplateProject.KIND_TEMPLATE),
        'example_templates': TemplateProject.objects.filter(template_kind=TemplateProject.KIND_EXAMPLE),
        'demo_templates': TemplateProject.objects.filter(template_kind=TemplateProject.KIND_SDK_DEMO),
        'default_template_id': settings.DEFAULT_TEMPLATE
    })

@require_safe
@login_required
def project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    return render(request, 'ide/project.html', {'project': project})

@require_safe
@login_required
def create(request):
    return render(request, 'ide/create.html')

@require_safe
@login_required
def project_info(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_files = SourceFile.objects.filter(project=project)
    resources = ResourceFile.objects.filter(project=project)
    output = {
        'success': True,
        'name': project.name,
        'last_modified': str(project.last_modified),
        "version_def_name": project.version_def_name,
        'source_files': [{'name': f.file_name, 'id': f.id} for f in source_files],
        'resources': [{
            'id': x.id,
            'file_name': x.file_name,
            'kind': x.kind,
            'identifiers': [y.resource_id for y in x.identifiers.all()]
        } for x in resources]
    }

    return HttpResponse(json.dumps(output), content_type="application/json")

@require_POST
@login_required
def create_source_file(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        f = SourceFile.objects.create(project=project, file_name=request.POST['name'])
    except IntegrityError as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True, "file": {"id": f.id, "name": f.file_name}}), content_type="application/json")

@require_safe
@csrf_protect
@login_required
def load_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    try:
        content = source_file.get_contents()
    except Exception as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True, "source": content}), content_type="application/json")

@require_POST
@login_required
def save_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    try:
        source_file.save_file(request.POST['content'])
    except Exception as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True}), content_type="application/json")

@require_POST
@login_required
def delete_source_file(request, project_id, file_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    source_file = get_object_or_404(SourceFile, pk=file_id, project=project)
    try:
        source_file.delete()
    except Exception as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True}), content_type="application/json")

@require_POST
@login_required
def create_resource(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    kind = request.POST['kind']
    resource_ids = json.loads(request.POST['resource_ids'])
    file_name = request.FILES['file'].name
    resources = []
    try:
        with transaction.commit_on_success():
            rf = ResourceFile.objects.create(project=project, file_name=file_name, kind=kind)
            for r in resource_ids:
                regex = r['regex'] if 'regex' in r else None
                resources.append(ResourceIdentifier.objects.create(resource_file=rf, resource_id=r['id'], character_regex=regex))
            rf.save_file(request.FILES['file'])
    except Exception as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True, "file": {
            "id": rf.id,
            "kind": rf.kind,
            "file_name": rf.file_name,
            "resource_ids": [{'id': x.resource_id, 'regex': x.character_regex} for x in resources],
            "identifiers": [x.resource_id for x in resources]
        }}), content_type="application/json")

@require_safe
@login_required
def resource_info(request, project_id, resource_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    resource = get_object_or_404(ResourceFile, pk=resource_id)
    resources = resource.get_identifiers()
    return HttpResponse(json.dumps({
        'success': True,
        'resource': {
            'resource_ids': [{'id': x.resource_id, 'regex': x.character_regex} for x in resources],
            'id': resource.id,
            'file_name': resource.file_name,
            'kind': resource.kind
        }
    }), content_type="application/json")

@require_POST
@login_required
def delete_resource(request, project_id, resource_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    resource = get_object_or_404(ResourceFile, pk=resource_id, project=project)
    try:
        resource.delete()
    except Exception as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True}), content_type="application/json")

@require_POST
@login_required
def update_resource(request, project_id, resource_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    resource = get_object_or_404(ResourceFile, pk=resource_id, project=project)
    resource_ids = json.loads(request.POST['resource_ids'])
    try:
        with transaction.commit_on_success():
            # Lazy approach: delete all the resource_ids and recreate them.
            # We could do better.
            resources = []
            ResourceIdentifier.objects.filter(resource_file=resource).delete()
            for r in resource_ids:
                regex = r['regex'] if 'regex' in r else None
                resources.append(ResourceIdentifier.objects.create(resource_file=resource, resource_id=r['id'], character_regex=regex))

            if 'file' in request.FILES:
                resource.save_file(request.FILES['file'])
    except Exception as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True, "file": {
            "id": resource.id,
            "kind": resource.kind,
            "file_name": resource.file_name,
            "resource_ids": [{'id': x.resource_id, 'regex': x.character_regex} for x in resources],
            "identifiers": [x.resource_id for x in resources]
        }}), content_type="application/json")

@require_POST
@login_required
def compile_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    build = BuildResult.objects.create(project=project)
    run_compile.delay(build.id)
    return HttpResponse(json.dumps({"success": True, "build_id": build.id}), content_type="application/json")

@require_safe
@login_required
def last_build(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        build = project.builds.order_by('-started')[0]
    except (IndexError, BuildResult.DoesNotExist) as e:
        return HttpResponse(json.dumps({"success": True, "build": None}), content_type="application/json")
    else:
        b = {
            'uuid': build.uuid,
            'state': build.state,
            'started': str(build.started),
            'finished': str(build.finished) if build.finished else None,
            'id': build.id,
            'pbw': build.pbw_url,
            'log': build.build_log_url
        }
        return HttpResponse(json.dumps({"success": True, "build": b}), content_type="application/json")

@require_safe
@login_required
def build_history(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        builds = project.builds.order_by('-started')[:10]
    except (IndexError, BuildResult.DoesNotExist) as e:
        return HttpResponse(json.dumps({"success": True, "build": None}), content_type="application/json")
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
                'log': build.build_log_url
            })
        return HttpResponse(json.dumps({"success": True, "builds": out}), content_type="application/json")

@require_POST
@login_required
def create_project(request):
    name = request.POST['name']
    template_id = request.POST.get('template', None)
    try:
        with transaction.commit_on_success():
            project = Project.objects.create(name=name, owner=request.user)
            if template_id is not None and int(template_id) != 0:
                template = TemplateProject.objects.get(pk=int(template_id))
                template.copy_into_project(project)
    except IntegrityError as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True, "id": project.id}), content_type="application/json")

@require_POST
@login_required
def save_project_settings(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    try:
        new_name = request.POST['name']
        new_version_def_name = request.POST['version_def_name']
        project.name = new_name
        project.version_def_name = new_version_def_name
        project.save()
    except IntegrityError as e:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True}), content_type="application/json")

@require_POST
@login_required
def delete_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    if not bool(request.POST.get('confirm', False)):
        return HttpResponse(json.dumps({"success": False, "error": "Not confirmed."}), content_type="application/json")
    try:
        project.delete()
    except:
        return HttpResponse(json.dumps({"success": False, "error": str(e)}), content_type="application/json")
    else:
        return HttpResponse(json.dumps({"success": True}), content_type="application/json")

@require_safe
@login_required
def show_resource(request, project_id, resource_id):
    resource = get_object_or_404(ResourceFile, pk=resource_id, project__owner=request.user)
    content_type = {'png': 'image/png', 'png-trans': 'image/png', 'font': 'application/octet-stream', 'raw': 'application/octet-stream'}
    response = HttpResponse(open(resource.local_filename), content_type=content_type[resource.kind])
    response['Content-Disposition'] = "attachment; filename=\"%s\"" % resource.file_name
    return response
