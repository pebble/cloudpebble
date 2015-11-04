from datetime import datetime, timedelta
from django.db import transaction
from celery import task
from time import sleep

from ide.models.monkey import TestSession, TestRun, TestCode
from ide.models.files import TestFile

__author__ = 'joe'


def setup_test_session(project, test_ids = None):
    with transaction.atomic():
        # Create a test session
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
            run = TestRun.objects.create(session=session, test=test, original_name=test.file_name)
            run.save()
            runs.append(run)

    # Return the session and its runs
    return session, runs


@task(ignore_result=True, acks_late=True)
def run_test_session(session_id):
    import random
    #TODO: ignore_result? acks_late?
    session = TestSession.objects.get(pk=session_id)
    runs = TestRun.objects.filter(session=session)
    # Set the session as having started now
    session.date_started = datetime.now()
    session.save()
# try:
    # Run all the tests
    for run in runs:
        run.date_started = datetime.now()
        run.save()
        sleep(1)
        # TODO: automated testing implementation, actually run the tests
        run.code = random.randint(-2, 1)
        if run.code == 0:
            run.code = 1
        run.log = "Test log\nThis is a fake run :)"
        run.date_completed = datetime.now()
        run.save()


# except Exception as e:
#     with transaction.atomic():
#         for run in runs:
#             run.code = TestCode.ERROR
#             run.save()
#     print e
# finally:
    session.date_completed = datetime.now()
    session.save()
    return True
