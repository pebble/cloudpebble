from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ide.models import TestCode
from ide.models.monkey import TestSession
from utils import orchestrator
from utils.bundle import TestBundle


# TODO: is acks_late needed for any of these?
@shared_task
def start_qemu_test(session_id, callback_url, emu, server, token, update):
    session = TestSession.objects.get(id=session_id)
    try:
        bundle = TestBundle(session=session)
        bundle.run_on_qemu(
            callback_url=callback_url,
            server=server,
            token=token,
            verify=settings.COMPLETION_CERTS,
            emu=emu,
            update=update
        )
    except Exception as e:
        session.fail(message=str(e))
        raise


@shared_task
def start_orchestrator_test(session_id, callback_url):
    session = TestSession.objects.get(id=session_id)
    try:
        bundle = TestBundle(session=session)
        bundle.run_on_orchestrator(callback_url)
    except Exception as e:
        session.fail(message=str(e))
        raise


@shared_task
def notify_orchestrator_session(session_id, job_info):
    session = TestSession.objects.get(id=session_id)
    date_completed = timezone.now()
    try:
        with transaction.atomic():
            # find each test in "tests"
            for test_name, test_info in job_info["tests"].iteritems():
                # extract information from the test info
                platform = orchestrator.platform_for_device(test_info['devices']['firmware'])
                log_id = test_info['_id']
                artefacts = test_info['result']['artifacts']
                test_return = test_info["result"]["ret"]

                # for each test, download the logs
                log = orchestrator.get_job_log(log_id)
                # save the test results and logs in the database
                # TODO: better assign test result
                test_result = TestCode.PASSED if int(test_return) == 0 else TestCode.FAILED
                run = session.runs.get(test__file_name=test_name, platform=platform)
                run.code = test_result
                run.log = log
                run.artefacts = artefacts
                run.date_completed = date_completed
                run.save()
    except Exception as e:
        # If anything goes wrong, mark all pending runs for the session as errors
        session.fail(message=str(e))
        raise
    finally:
        # If the session has no pending runs, it is complete.
        # Select for update here is used to prevent a race condition which could occur
        # if multiple notifications happen simultaneously
        pending_run_count = session.runs.select_for_update().filter(code=0)
        if pending_run_count > 0:
            session.date_completed = date_completed
            session.save()
