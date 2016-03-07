from celery import task
from django.conf import settings

import requests

__author__ = 'katharine'


@task(ignore_result=True)
def td_add_events(event):
    result = requests.post(settings.TD_URL, data=event)
    result.raise_for_status()
