from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.utils import simplejson as json
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.views.decorators.http import require_safe, require_POST
from django.views.decorators.csrf import csrf_protect

from ide.models import Project, SourceFile

@require_safe
@login_required
def index(request):
    my_projects = Project.objects.filter(owner=request.user).order_by('-last_modified')
    return render(request, 'ide/index.html', {'my_projects': my_projects})

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
    output = {
        'success': True,
        'name': project.name,
        'kind': project.app_kind,
        'last_modified': str(project.last_modified),
        'last_compiled': str(project.last_compiled) if project.last_compiled else None,
        'last_build_successful': project.last_build_successful,
        'source_files': [{'name': f.file_name, 'id': f.id} for f in source_files]
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
