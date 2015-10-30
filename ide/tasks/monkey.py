from datetime import datetime, timedelta
from django.db import transaction
from celery import task
from time import sleep

from ide.models.monkey import TestSession, TestRun, TestCode
from ide.models.files import TestFile
__author__ = 'joe'


def setup_test_session(project, test_ids = None):
    # Create a test session

    with transaction.atomic():
        session = TestSession.objects.create(project=project)
        session.save()
        runs = []

        if test_ids is None:
            # If test_ids is None, get all tests for the project
            tests = TestFile.objects.filter(project=project)
        else:
            # Otherwise, get all requested test(s)
            tests = TestFile.objects.filter(project=project, id__in=test_ids)

        # Then make a test run for every test
        for test in tests:
            run = TestRun.objects.create(session=session, test=test)
            run.save()
            runs.append(run)

        # Return the session and its runs

    return session, runs


@task(ignore_result=True, acks_late=True)
def run_test_session(session_id):
    #TODO: ignore_result? acks_late?
    session = TestSession.objects.get(pk=session_id)
    runs = TestRun.objects.filter(session=session)
    # Set the session as having started now
    session.date_started = datetime.now()
    session.save()
    # Run all the tests

    for run in runs:
        run.date_started = datetime.now()
        run.save()

    # TODO: automated testing implementation, actually run the tests
    sleep(5)

    for run in runs:
        run.code = TestCode.COMPLETE
        run.log = "Test log\nThis is a fake run :)"
        run.date_completed = datetime.now()
        run.save()
    session.date_completed = datetime.now()

    return True
