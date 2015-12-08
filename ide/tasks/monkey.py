from datetime import datetime, timedelta
from django.db import transaction
from celery import task
from time import sleep

from ide.models.monkey import TestSession, TestRun, TestCode
from ide.models.files import TestFile

__author__ = 'joe'

@task(ignore_result=True, acks_late=True)
def run_test_session(session_id):
    session = TestSession.objects.get(pk=session_id)
    runs = TestRun.objects.filter(session=session)
    session.date_started = datetime.now()
    session.save()

    for run in runs:
        run.date_started = datetime.now()
        run.save()

    return True
