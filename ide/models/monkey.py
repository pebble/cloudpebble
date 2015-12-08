import traceback
import os

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction
import utils.s3 as s3
from ide.models.meta import IdeModel, TextFile
from ide.models.files import TestFile

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

    @staticmethod
    def setup_test_session(project, test_ids=None):
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
