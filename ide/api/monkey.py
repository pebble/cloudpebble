import requests
import urllib
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.core.urlresolvers import reverse
from django.views.decorators.http import require_POST, require_safe
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.utils import timezone
from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.monkey import TestSession, TestRun, TestCode, TestLog
from django.db import transaction
from utils.bundle import TestBundle


__author__ = 'joe'


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
        'date_added': str(run.session.date_added)
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
    result = {
        'id': session.id,
        'date_added': str(session.date_added),
        'passes': len(runs.filter(code=TestCode.PASSED)),
        'fails': len(runs.filter(code__lt=0)),
        'run_count': len(runs)
    }
    if session.date_completed is not None:
        result['date_completed'] = str(session.date_completed)
    if include_runs:
        result['runs'] = [serialise_run(run, link_session=False, link_test=True) for run in runs]
    return result


# GET /project/<id>/test_sessions/<session_id>
@require_safe
@login_required
def get_test_session(request, project_id, session_id):
    """ Fetch a single test session by its ID """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    session = get_object_or_404(TestSession, pk=session_id, project=project)
    # TODO: KEEN
    return json_response({"data": serialise_session(session)})


# GET /project/<id>/test_sessions
@require_safe
@login_required
def get_test_sessions(request, project_id):
    """ Fetch all test sessions for a project, optionally filtering by ID """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    id = request.GET.get('id', None)
    kwargs = {'project': project}
    if id is not None:
        kwargs['id'] = id
    sessions = TestSession.objects.filter(**kwargs)
    # TODO: KEEN
    # TODO: deal with errors here on the client
    return json_response({"data": [serialise_session(session) for session in sessions]})



# GET /project/<id>/test_runs/<run_id>
@require_safe
@login_required
def get_test_run(request, project_id, run_id):
    """ Fetch a single test run """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    run = get_object_or_404(TestRun, pk=run_id, session__project=project)
    # TODO: KEEN
    return json_response({"data": serialise_run(run)})

# GET /project/<id>/test_runs?test=&session=
@require_safe
@login_required
def get_test_runs(request, project_id):
    """ Fetch a list of test runs, optionally filtering by test ID or session ID """
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
    # TODO: KEEN
    return json_response({"data": [serialise_run(run, link_test=True, link_session=True) for run in runs]})

@require_safe
@login_required
def get_test_run_log(request, project_id, run_id):
    """ Download the log file for a test run """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    run = get_object_or_404(TestRun, pk=run_id, session__project=project)
    log = get_object_or_404(TestLog, test_run=run)
    contents = log.get_contents()
    return HttpResponse(contents, content_type="text/plain")

@require_POST
@login_required
def run_qemu_test(request, project_id, test_id):
    """ Request an interactive QEMU test session """
    # Load request parameters and database objects
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    token = request.POST['token']
    host = request.POST['host']
    emu = request.POST['emu']
    # Get QEMU server which corresponds to the requested host
    server = next(x for x in set(settings.QEMU_URLS) if host in x)

    # If the request fails, the test session/runs will not be created
    with transaction.atomic():
        bundle = TestBundle(project, [test_id])
        session, runs = bundle.setup_test_session()
        # TODO: Since we know we're communicating with localhost things, build_absolute_uri may not be appropriate.
        callback_url = request.build_absolute_uri(reverse('ide:notify_test_session', args=[project_id, session.id]))
        post_url = server + 'qemu/%s/test' % urllib.quote_plus(emu)
        print "Posting to %s" % post_url

        with bundle.open() as stream:
            result = requests.post(post_url,
                                   data={'token': token, 'notify': callback_url},
                                   verify=settings.COMPLETION_CERTS,
                                   files=[('archive', ('archive.zip', stream))])

            # TODO: Consider doing something to get more meaningful error messages
            result.raise_for_status()

    response = result.json()
    subscribe_url = server + 'qemu/%s/test/subscribe' % urllib.quote_plus(emu)
    response['run_id'] = runs[0].id
    response['session_id'] = session.id
    response['test_id'] = int(test_id)
    response['subscribe_url'] = subscribe_url
    return json_response(response)


@require_POST
@csrf_exempt
def notify_test_session(request, project_id, session_id):
    """ Callback from interactive test session. Sets the code/log/date for a test session's runs,
    and uses the qemu launch token to ensure that only the cloudpebble-qemu-controller can call it.
    @csrf_exempt is needed to prevent the qemu-controller from being blocked by Django's CSRF Prevention."""

    # TODO: deal with invalid input/situations (e.g. notified twice)
    project = get_object_or_404(Project, pk=int(project_id))
    session = get_object_or_404(TestSession, pk=int(session_id), project=project)
    token = request.POST['token']
    if token != settings.QEMU_LAUNCH_AUTH_HEADER:
        print "Rejecting test result, posted token %s doesn't match %s" % (request.POST['token'], settings.QEMU_LAUNCH_AUTH_HEADER)
        return json_failure({}, status=403)
    log = request.POST['log']
    code = int(request.POST['code'])
    if code == 0:
        result = TestCode.PASSED
    elif code == 1:
        result = TestCode.FAILED
    else:
        result = TestCode.ERROR

    with transaction.atomic():
        session.date_completed = timezone.now()
        session.save()
        for run in session.runs.all():
            run.code = result
            run.log = log
            run.date_completed = timezone.now()
            run.save()
    return json_response({})


@require_safe
@login_required
def download_tests(request, project_id):
    """ Download all the tests for a project as a ZIP file. """
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    test_ids = request.GET.get('tests', None)

    with TestBundle(project, test_ids, include_pbw=True).open() as f:
        return HttpResponse(f.read(), content_type='application/zip')


# POST /project/<id>/test_sessions
@require_POST
@login_required
def post_test_session(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    # We may receive a list of particular tests to run
    # If not, all tests will be run.
    test_ids = request.POST.get('tests', None)

    bundle = TestBundle(project, include_pbw=True)
    bundle.setup_test_session()
    with bundle.open() as f:
        # Send the tests to TA
        pass
    
    # return json_response({"data": serialise_session(session, include_runs=True)})


# TODO: 'ping' functions to see if anything has changed. Or, "changed since" parameters.
