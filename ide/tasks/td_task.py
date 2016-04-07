from celery import shared_task
from django.conf import settings

import requests

__author__ = 'katharine'


@shared_task(ignore_result=True)
def td_add_events(event):
    result = requests.post(settings.TD_URL, data=event)
    result.raise_for_status()
