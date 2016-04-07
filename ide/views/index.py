from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_safe
from ide.models.project import Project, TemplateProject
from utils.td_helper import send_td_event

__author__ = 'katharine'


@require_safe
@login_required
@ensure_csrf_cookie
def index(request, github_account=None, github_project=None):
    user = request.user
    my_projects = Project.objects.filter(owner=user).order_by('-last_modified')
    if not user.settings.accepted_terms:
        # Screw it.
        # user_settings = user.settings
        # user_settings.accepted_terms = True
        # user_settings.save()

        return render(request, 'ide/new-owner.html', {
            'my_projects': my_projects
        })
    elif settings.SOCIAL_AUTH_PEBBLE_REQUIRED and user.social_auth.filter(provider='pebble').count() == 0:
        return render(request, 'registration/merge_account.html')
    else:
        send_td_event('cloudpebble_project_list', request=request)
        return render(request, 'ide/index.html', {
            'my_projects': my_projects,
            'sdk_templates': TemplateProject.objects.filter(template_kind=TemplateProject.KIND_TEMPLATE),
            'demo_templates': TemplateProject.objects.filter(template_kind=TemplateProject.KIND_SDK_DEMO),
            'default_template_id': settings.DEFAULT_TEMPLATE,
            'user': user,
        })
