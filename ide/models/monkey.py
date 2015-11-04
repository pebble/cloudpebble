import traceback
import os

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction
import utils.s3 as s3
from ide.models.meta import IdeModel, TextFile

__author__ = 'joe'


class TestCode:
    ERROR = -2
    FAILED = -1
    PENDING = 0
    PASSED = 1


class TestSession(IdeModel):
    date_added = models.DateTimeField(auto_now_add=True)
    date_started = models.DateTimeField(null=True)
    date_completed = models.DateTimeField(null=True)
    project = models.ForeignKey('Project', related_name='test_sessions')

    class Meta(IdeModel.Meta):
        ordering = ['-date_added']

class TestLog(TextFile):
    folder = 'tests/logs'
    bucket_name = 'source'  # TODO: is this OK?
    test_run = models.OneToOneField('TestRun', related_name='logfile')

class TestRun(IdeModel):
    session = models.ForeignKey('TestSession', related_name='runs')
    test = models.ForeignKey('TestFile', related_name='runs', null=True, on_delete=models.SET_NULL)

    date_started = models.DateTimeField(null=True)
    date_completed = models.DateTimeField(null=True)

    original_name = models.CharField(max_length=100)
    code = models.IntegerField(default=TestCode.PENDING)

    @property
    def log(self):
        if self.has_log:
            return self.logfile.get_contents()
        else:
            return None

    @log.setter
    def log(self, value):
        with transaction.atomic():
            if self.has_log:
                self.logfile.delete()
            logfile = TestLog.objects.create(test_run=self)
            logfile.save()
            logfile.save_file(value)

    @property
    def has_log(self):
        try:
            return self.logfile is not None
        except TestLog.DoesNotExist:
            return False

    @property
    def has_test(self):
        return self.test is not None

    @property
    def name(self):
        if self.test is not None:
            return self.test.file_name
        else:
            return self.original_name

    class Meta(IdeModel.Meta):
        unique_together = ('test', 'session')
        ordering = ['original_name', '-date_started']


@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender in (TestLog, ):
        if settings.AWS_ENABLED:
            try:
                s3.delete_file(instance.s3_path)
            except:
                traceback.print_exc()
        else:
            try:
                os.unlink(instance.local_filename)
            except OSError:
                pass
