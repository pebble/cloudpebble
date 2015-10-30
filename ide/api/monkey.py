import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, HttpResponseRedirect
from django.db import transaction
from django.views.decorators.http import require_POST, require_safe
from django.core.urlresolvers import reverse
from utils.keen_helper import send_keen_event

from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.files import TestFile, ScreenshotSet, ScreenshotFile
from ide.models.monkey import TestSession, TestRun
from ide.tasks.monkey import run_test_session, setup_test_session
import utils.s3 as s3


__author__ = 'joe'


def serialise_run(run, link_test=True, link_session=True):
    result = {
        'id': run.id,
    }
    if link_test:
        result['test'] = {
            'id': run.test.id,
            'name': run.test.file_name
        }
    if link_session:
        result['session_id'] = run.session.id
    if run.log is not None:
        result['log'] = run.log.split('\n')
    if run.code is not None:
        result['code'] = run.code
    if run.date_started is not None:
        result['date_started'] = str(run.date_started)
    if run.date_completed is not None:
        result['date_completed'] = str(run.date_completed)
    return result


def serialise_session(session, include_runs=False):
    result = {'id': session.id}
    if session.date_started is not None:
        result['date_started'] = str(session.date_started)
    if session.date_completed is not None:
        result['date_completed'] = str(session.date_completed)
    if include_runs:
        runs = TestRun.objects.filter(session=session)
        result['runs'] = [serialise_run(run, link_session=False) for run in runs]
    return result


# GET /project/<id>/test_sessions/<session_id>
@require_safe
@login_required
def get_test_session(request, project_id, session_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    session = get_object_or_404(TestSession, pk=session_id, project=project)
    # TODO: KEEN
    return json_response({"data": serialise_session(session, include_runs=True)})


# GET /project/<id>/test_sessions?date_from=&date_to=
@require_safe
@login_required
def get_test_sessions(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    sessions = TestSession.objects.filter(project=project)
    # TODO: KEEN
    return json_response({"data": [serialise_session(session) for session in sessions]})



# GET /project/<id>/test_runs/<run_id>
@require_safe
@login_required
def get_test_run(request, project_id, run_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    run = get_object_or_404(TestRun, pk=run_id, session__project=project)
    # TODO: KEEN
    return json_response({"data": serialise_run(run)})


# GET /project/<id>/test_runs?test=&session=&date_from=&date_to=
@require_safe
@login_required
def get_test_runs(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    test_id = request.GET.get('test', None)
    session_id = request.GET.get('session', None)
    kwargs = {'session__project': project}
    if test_id is not None:
        kwargs['test__id'] = test_id
        link_test = False
    if session_id is not None:
        kwargs['session__id'] = session_id
        link_session = False
    runs = TestRun.objects.filter(**kwargs)

    # TODO: KEEN
    return json_response({"data": [serialise_run(run, link_test=(test_id is None), link_session=(session_id is None)) for run in runs]})


# POST /project/<id>/test_sessions
@require_POST
@login_required
def post_test_session(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    # We may receive a list of particular tests to run
    # If not, all tests will be run.
    test_ids = request.POST.get('tests', None)
    if test_ids is not None:
        test_ids = [int(test_id) for test_id in test_ids.split(',')]

    # Make the database objects
    session, runs = setup_test_session(project, test_ids)

    # Then run the monkeyscript task
    run_test_session.delay(session.id)
    # TODO: KEEN
    return json_response({"data": serialise_session(session, include_runs=True)})