import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.views.decorators.http import require_safe, require_POST
from ide.models.build import BuildResult
from ide.models.project import Project
from ide.tasks.git import hooked_commit
from ide.utils import generate_half_uuid
from utils.td_helper import send_td_event
from ide.utils.regexes import regexes

__author__ = 'katharine'


@require_safe
@login_required
@ensure_csrf_cookie
def view_project(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    if project.app_uuid is None:
        project.app_uuid = generate_half_uuid()
    if project.app_company_name is None:
        project.app_company_name = request.user.username
    if project.app_short_name is None:
        project.app_short_name = project.name
    if project.app_long_name is None:
        project.app_long_name = project.app_short_name
    if project.app_version_label is None:
        project.app_version_label = '1.0'
    app_keys = project.get_parsed_appkeys()

    send_td_event('cloudpebble_open_project', request=request, project=project)
    try:
        token = request.user.social_auth.get(provider='pebble').extra_data['access_token']
    except:
        token = ''
    return render(request, 'ide/project.html', {
        'project': project,
        'app_keys': app_keys,
        'font_css': settings.TYPOGRAPHY_CSS,
        'libpebble_proxy': json.dumps(settings.LIBPEBBLE_PROXY),
        'token': token,
        'phone_shorturl': settings.PHONE_SHORTURL,
        'supported_platforms': project.supported_platforms,
        'regexes': regexes,
        'regexes_json': json.dumps(regexes.regex_dictionary)
    })


@csrf_exempt
@require_POST
def github_hook(request, project_id):
    hook_uuid = request.GET['key']
    project = get_object_or_404(Project, pk=project_id, github_hook_uuid=hook_uuid)

    push_info = json.loads(request.POST['payload'])
    if push_info['ref'] == 'refs/heads/%s' % (project.github_branch or push_info['repository']['master_branch']):
        hooked_commit.delay(project_id, push_info['after'])

    return HttpResponse('ok')


@require_safe
def build_status(request, project_id):
    project = get_object_or_404(Project, pk=project_id)
    try:
        last_build = BuildResult.objects.order_by('-id').filter(~Q(state=BuildResult.STATE_WAITING), project=project)[0]
    except IndexError:
        return HttpResponseRedirect(settings.STATIC_URL + '/ide/img/status/error.png')
    if last_build.state == BuildResult.STATE_SUCCEEDED:
        return HttpResponseRedirect(settings.STATIC_URL + '/ide/img/status/passing.png')
    else:
        return HttpResponseRedirect(settings.STATIC_URL + '/ide/img/status/failing.png')


@require_safe
@login_required
@ensure_csrf_cookie
def import_gist(request, gist_id):
    send_td_event('cloudpebble_gist_landing', data={'data': {'gist_id': gist_id}}, request=request)
    return render(request, 'ide/gist-import.html', {
        'gist_id': gist_id,
        'blurb': request.GET.get('blurb', None)
    })


def qemu_config(request):
    return render(request, 'ide/qemu-config.html')


def enter_phone_token(request):
    return render(request, 'ide/qemu-enter-token.html')
