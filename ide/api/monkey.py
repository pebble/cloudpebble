import logging
import urllib
import os
from functools import wraps

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.core.urlresolvers import reverse
from django.db import transaction
from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import cache_control
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import last_modified
from django.views.decorators.http import require_POST, require_safe

import ide.tasks.monkey as tasks
from ide.models import ScreenshotSet, ScreenshotFile
from ide.models.monkey import TestSession, TestRun, TestCode, TestLog
from ide.models.project import Project
from utils import orchestrator
from utils.bundle import TestBundle
from utils.jsonview import json_view

logger = logging.getLogger(__name__)

__author__ = 'joe'


def _filtered_max(*args):
    """ Find the maximum of all arguments, completely ignoring any values of None """
    filtered = [a for a in args if a]
    return max(filtered) if len(filtered) > 0 else None


def serialise_run(run, link_test=True, link_session=True):
    """ Prepare a TestRun for representation in JSON

    :param run: TestRun to represent
    :param link_test: if True, adds in data from the TestRun's test
    :param link_session: if True, adds in data from the TestRun's session
    :return: A dict full of info from the TestRun object
    """
    result = {
        'id': run.id,
        'name': run.name,
        'logs': reverse('ide:get_test_run_log', args=[run.session.project.id, run.id]) if run.has_log else None,
        'date_added': str(run.session.date_added),
        'artefacts': run.artefacts,
        'platform': run.platform
    }

    if link_test and run.has_test:
        result['test'] = {
            'id': run.test.id,
            'name': run.test.file_name
        }

    if link_session:
        result['session_id'] = run.session.id
    if run.code is not None:
        result['code'] = run.code
    result['date_added'] = str(run.session.date_added)
    if run.date_completed is not None:
        result['date_completed'] = str(run.date_completed)
    return result


def serialise_session(session, include_runs=False):
    """ Prepare a TestSession for representation in JSON

    :param session: TestSession to represent
    :param include_runs: if True, includes a list of serialised test runs
    :return: A dict full of info from the TestSession object
    """
    runs = TestRun.objects.filter(session=session)

    pendings = runs.filter(code=TestCode.PENDING)
    passes = runs.filter(code=TestCode.PASSED)
    fails = runs.filter(code__lt=0)
    status = TestCode.PENDING if pendings.count() > 0 else (TestCode.FAILED if fails.count() > 0 else TestCode.PASSED)
    result = {
        'id': session.id,
        'date_added': str(session.date_added),
        'passes': passes.count(),
        'fails': fails.count(),
        'run_count': runs.count(),
        'status': status,
        'kind': session.kind
    }
    if session.date_completed is not None:
        result['date_completed'] = str(session.date_completed)
    if include_runs:
        result['runs'] = [serialise_run(run, link_session=False, link_test=True) for run in runs]
    return result


def testbench_privilages_required(f):
    """ Decorator for 404ing any test-bench API requests from unauthorized users. """

    @wraps(f)
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_testbench_user:
            # As far as non-authorized clients are concerned, this test point should not exist at all.
            raise Http404
        return f(request, *args, **kwargs)

    return _wrapped


def get_latest_run_date_for_sessions(sessions):
    """ Given a list of sessions, find the latest date_completed of all of their runs
    :param sessions: List or queryset of TestSessions
    """
    try:
        return TestRun.objects.filter(session__in=sessions).exclude(date_completed__isnull=True).latest(
            "date_completed").date_completed
    except TestRun.DoesNotExist:
        return None


def get_latest_session_date(sessions):
    """ Given a list of sessions, find the latest time that any of them or their runs were added/completed
    :param sessions: List or queryset of TestSessions
    """
    try:
        latest_completed = sessions.exclude(date_completed__isnull=True).latest("date_completed").date_completed
    except TestSession.DoesNotExist:
        latest_completed = None
    try:
        latest_added = sessions.latest("date_added").date_added
    except TestSession.DoesNotExist:
        latest_added = None
    latest_run_completed = get_latest_run_date_for_sessions(sessions)
    return _filtered_max(latest_added, latest_completed, latest_run_completed)


@testbench_privilages_required
def get_test_session_latest(request, project_id, session_id):
    """ Get the last-modified date for a get_test_session request """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    session = get_object_or_404(TestSession, pk=session_id, project=project)
    return _filtered_max(session.date_completed, session.date_added, get_latest_run_date_for_sessions([session]))


# GET /project/<id>/test_sessions/<session_id>
@testbench_privilages_required
@last_modified(get_test_session_latest)
@cache_control(must_revalidate=True, max_age=1)
@require_safe
@login_required
@json_view
def get_test_session(request, project_id, session_id):
    """ Fetch a single test session by its ID """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    session = get_object_or_404(TestSession, pk=session_id, project=project)
    return {"data": serialise_session(session)}


@testbench_privilages_required
def get_sessions_for_get_sessions_request(request, project_id):
    """ Get the sessions relevant to a get_sessions request """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    session_id = request.GET.get('id', None)
    kwargs = {'project': project}
    if session_id is not None:
        kwargs['id'] = session_id
    return TestSession.objects.filter(**kwargs)


@testbench_privilages_required
def get_test_run_latest(request, project_id, run_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    run = get_object_or_404(TestRun, pk=run_id, session__project=project)
    return _filtered_max(run.session.date_added, run.date_completed)


# GET /project/<id>/test_runs/<run_id>
@testbench_privilages_required
@last_modified(get_test_run_latest)
@cache_control(must_revalidate=True, max_age=1)
@require_safe
@login_required
@json_view
def get_test_run(request, project_id, run_id):
    """ Fetch a single test run """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    run = get_object_or_404(TestRun, pk=run_id, session__project=project)
    return {"data": serialise_run(run)}


def get_test_sessions_latest(request, project_id):
    """ Get the last-modified date for a get_test_sessions request """
    sessions = get_sessions_for_get_sessions_request(request, project_id)
    return get_latest_session_date(sessions)


# GET /project/<id>/test_sessions
@testbench_privilages_required
@last_modified(get_test_sessions_latest)
@cache_control(must_revalidate=True, max_age=1)
@require_safe
@login_required
@json_view
def get_test_sessions(request, project_id):
    """ Fetch all test sessions for a project, optionally filtering by ID """
    sessions = get_sessions_for_get_sessions_request(request, project_id)
    return {"data": [serialise_session(session) for session in sessions]}


def get_test_runs_for_get_test_runs_request(project_id, request):
    """ Get the runs relevant to a get_test_runs request """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    test_id = request.GET.get('test', None)
    session_id = request.GET.get('session', None)
    run_id = request.GET.get('id', None)
    kwargs = {'session__project': project}
    if test_id is not None:
        kwargs['test__id'] = test_id
    if session_id is not None:
        kwargs['session__id'] = session_id
    if run_id is not None:
        kwargs['id'] = run_id
    runs = TestRun.objects.filter(**kwargs)
    return runs


@testbench_privilages_required
def get_test_runs_latest(request, project_id):
    """ Get the last-modified date for a get_test_runs request """
    runs = get_test_runs_for_get_test_runs_request(project_id, request)
    try:
        latest_run_completed = runs.exclude(date_completed__isnull=True).latest("date_completed").date_completed
    except TestRun.DoesNotExist:
        latest_run_completed = None
    latest_session = get_latest_session_date(TestSession.objects.filter(runs__in=runs))
    return _filtered_max(latest_run_completed, latest_session)


# GET /project/<id>/test_runs?test=&session=
@testbench_privilages_required
@cache_control(must_revalidate=True, max_age=1)
@last_modified(get_test_runs_latest)
@require_safe
@login_required
@json_view
def get_test_runs(request, project_id):
    """ Fetch a list of test runs, optionally filtering by test ID or session ID """
    runs = get_test_runs_for_get_test_runs_request(project_id, request)
    return {"data": [serialise_run(run, link_test=True, link_session=True) for run in runs]}


@testbench_privilages_required
@require_safe
@login_required
def get_test_run_log(request, project_id, run_id):
    """ Download the log file for a test run """
    # TODO: catch errors
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    run = get_object_or_404(TestRun, pk=run_id, session__project=project)
    log = get_object_or_404(TestLog, test_run=run)
    contents = log.get_contents()
    return HttpResponse(contents, content_type="text/plain")


@testbench_privilages_required
@require_POST
@login_required
@json_view
def run_qemu_test(request, project_id, test_id):
    """ Request an interactive QEMU test session """
    # Load request parameters and database objects
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    token = request.POST['token']
    host = request.POST['host']
    emu = request.POST['emu']
    platform = request.POST['platform']
    update = request.POST.get('update', False)
    # Get QEMU server which corresponds to the requested host
    server = next(x for x in set(settings.QEMU_URLS) if host in x)
    subscribe_url = server + 'qemu/%s/test/subscribe' % urllib.quote_plus(emu)

    # Create the session and make the run and callback URL.
    # This will fail if the session has more than one run
    session = TestSession.setup_session(project, [test_id], [platform], 'live')
    run = session.runs.get()
    callback_url = session.make_callback_url(request, token=token)

    # Start the task in celery
    task = tasks.start_qemu_test.delay(session.id, callback_url, emu, server, token, update)
    return {
        'run_id': run.id,
        'session_id': session.id,
        'subscribe_url': subscribe_url,
        'task_id': task.task_id
    }


@require_POST
@csrf_exempt
@json_view
def notify_test_session(request, project_id, session_id):
    """ Callback from interactive test session. Sets the code/log/date for a test session's runs,
    and uses the qemu launch token to ensure that only the cloudpebble-qemu-controller can call it.
    @csrf_exempt is needed to prevent the qemu-controller from being blocked by Django's CSRF Prevention."""

    # TODO: deal with invalid input/situations (e.g. notified twice)
    project = get_object_or_404(Project, pk=int(project_id))
    session = get_object_or_404(TestSession, pk=int(session_id), project=project)
    token = request.POST.get('token', None)
    if not token:
        token = request.GET['token']
    if token != settings.QEMU_LAUNCH_AUTH_HEADER:
        logging.warn("Rejecting test result, posted token %s doesn't match %s", token, settings.QEMU_LAUNCH_AUTH_HEADER)
        raise PermissionDenied

    orch_id = request.POST.get('id', None)

    # The procedure depends on whether orchestrator or qemu-controller are notifying us.
    if orch_id:
        # GET /api/jobs/<id>
        job_info = orchestrator.get_job_info(orch_id)
        tasks.notify_orchestrator_session.delay(session.id, job_info)
    else:
        uploaded_files = request.FILES.getlist('uploads[]')
        platform = request.POST.get('uploads_platform', None)
        log = request.POST['log']
        status = request.POST['status']
        notify_qemu_session(session, platform, status, log, uploaded_files)


def notify_qemu_session(session, platform, status, log, uploaded_files):
    date_completed = timezone.now()
    if status == 'passed':
        result = TestCode.PASSED
    elif status == 'failed':
        result = TestCode.FAILED
    else:
        result = TestCode.ERROR
    # Non-orchestrator notifications should only be for sessions with single runs
    run = TestRun.objects.get(session=session)
    with transaction.atomic():
        session.date_completed = date_completed
        run.code = result
        run.log = log
        run.date_completed = date_completed
        session.save()
        run.save()
    if uploaded_files:
        test = run.test
        for posted_file in uploaded_files:
            if posted_file.content_type != "image/png":
                raise ValueError("Screenshots must be PNG files")
            name = os.path.splitext(os.path.basename(posted_file.name))[0]
            screenshot_set, did_create_set = ScreenshotSet.objects.get_or_create(test=test, name=name)
            screenshot_file, did_create_file = ScreenshotFile.objects.get_or_create(screenshot_set=screenshot_set,
                                                                                    platform=platform)
            screenshot_file.save()
            screenshot_file.save_file(posted_file, file_size=posted_file.size)


@testbench_privilages_required
@require_safe
@login_required
def download_tests(request, project_id):
    """ Download all the tests for a project as a ZIP file. """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    test_ids = [int(test) for test in request.GET.get('tests', "").split(",") if test] or None

    with TestBundle(project, test_ids).open(frame_tests=False) as f:
        return HttpResponse(f.read(), content_type='application/zip')


# POST /project/<id>/test_sessions
@testbench_privilages_required
@require_POST
@login_required
@json_view
def post_test_session(request, project_id):
    # TODO: run as celery task?
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    test_ids = [int(test) for test in request.POST.get('tests', "").split(",") if test] or None
    platforms = project.last_built_platforms
    session = TestSession.setup_session(project, test_ids, platforms, 'batch')
    callback_url = session.make_callback_url(request, settings.QEMU_LAUNCH_AUTH_HEADER)

    task = tasks.start_orchestrator_test.delay(session.id, callback_url)
    return {
        "session": serialise_session(session, include_runs=True),
        "task_id": task.id
    }

# TODO: Analytics
