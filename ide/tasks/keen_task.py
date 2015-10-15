from celery import task
from django.conf import settings
from keen import KeenClient

__author__ = 'katharine'


@task(ignore_result=True)
def keen_add_events(events):
    KeenClient(project_id=settings.KEEN_PROJECT_ID, write_key=settings.KEEN_WRITE_KEY).add_events(events)
