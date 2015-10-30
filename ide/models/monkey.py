from django.db import models

from ide.models.meta import IdeModel

__author__ = 'joe'

class TestSession(IdeModel):
    date_started = models.DateTimeField(null=True)
    date_completed = models.DateTimeField(null=True)
    project = models.ForeignKey('Project', related_name='test_sessions')

class TestCode:
    QUEUED = 0
    COMPLETE = 1


class TestRun(IdeModel):
    date_started = models.DateTimeField(null=True)
    date_completed = models.DateTimeField(null=True)
    session = models.ForeignKey('TestSession', related_name='runs')
    test = models.ForeignKey('TestFile', related_name='runs')
    code = models.IntegerField(default=TestCode.QUEUED)
    log = models.TextField(blank=True, null=True) # logfile on server?

    class Meta(IdeModel.Meta):
        unique_together = ('test', 'session')
