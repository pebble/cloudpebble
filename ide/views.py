from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required

from ide.models import Project

@login_required
def index(request):
    my_projects = Project.objects.filter(owner=request.user).order_by('-last_modified')
    return render(request, 'ide/index.html', {'my_projects': my_projects})

@login_required
def project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    return render(request, 'ide/project.html', {'project': project})
    
@login_required
def create(request):
    return render(request, 'ide/create.html')
