import os
import traceback
from io import BytesIO

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import RegexValidator
from django.db import models
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils.timezone import now
from django.utils.translation import ugettext as _

import utils.s3 as s3
from ide.models.files import BinFile, ScriptFile
from ide.models.meta import IdeModel, TextFile
from ide.utils.image_correction import uncorrect
from utils.monkeyscript_helpers import frame_test_file

__author__ = 'joe'


class TestCode:
    ERROR = -2
    FAILED = -1
    PENDING = 0
    PASSED = 1


class TestSession(IdeModel):
    """ A TestSession is owned by a project contains a set of test runs. It represents a time that a set of N>=1 tests
    were run as one job."""
    date_added = models.DateTimeField(auto_now_add=True)
    date_completed = models.DateTimeField(null=True)
    project = models.ForeignKey('Project', related_name='test_sessions')
    SESSION_KINDS = (
        ('batch', _('Batch Test')),
        ('live', _('Live Test'))
    )
    kind = models.CharField(max_length=4, choices=SESSION_KINDS)

    class Meta(IdeModel.Meta):
        ordering = ['-date_added']


class TestLog(TextFile):
    """ A TestLog is a text file owned by a TestRun. It stores the console output from an AT process. """
    folder = 'tests/logs'
    bucket_name = 'source'  # TODO: is this OK?
    test_run = models.OneToOneField('TestRun', related_name='logfile')


class Artefact(IdeModel):
    log_name = models.CharField(max_length=100)
    link_name = models.CharField(max_length=100)
    test_log = models.ForeignKey('TestLog', related_name='artefacts')


class TestRun(IdeModel):
    """ A TestRun is owned by a TestSession and links to a TestFile. It stores the result code and date information for
    a particular time that a single test was run. """
    session = models.ForeignKey('TestSession', related_name='runs')
    test = models.ForeignKey('TestFile', related_name='runs', null=True, on_delete=models.SET_NULL)

    date_completed = models.DateTimeField(null=True)

    original_name = models.CharField(max_length=100)
    code = models.IntegerField(default=TestCode.PENDING)

    @property
    def artefacts(self):
        if self.has_log:
            return [[a.log_name, a.link_name] for a in Artefact.objects.filter(test_log=self.logfile)]

    @artefacts.setter
    def artefacts(self, value):
        if self.has_log:
            Artefact.objects.filter(test_log=self.logfile).delete()
        for artefact in value:
            Artefact.objects.create(test_log=self.logfile, log_name=artefact[0], link_name=artefact[1])

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
        ordering = ['original_name', '-session__date_added']


class TestFile(ScriptFile):
    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_-]+$")])
    project = models.ForeignKey('Project', related_name='test_files')
    bucket_name = 'source'
    folder = 'tests/scripts'
    target = 'test'

    def copy_screenshots_to_directory(self, directory):
        for screenshot_set in self.get_screenshot_sets():
            screenshot_set.copy_to_directory(directory)

    def copy_test_to_path(self, path, frame_test=True):
        self.copy_to_path(path)
        if frame_test:
            with open(path, 'r+') as f:
                full_test = frame_test_file(f, self.file_name, self.project.app_short_name)
            with open(path, 'w') as f:
                f.write(full_test)

    @property
    def project_path(self):
        return 'integration_tests/%s' % self.file_name

    @property
    def latest_code(self):
        try:
            return self.runs.latest('session__date_added').code
        except ObjectDoesNotExist:
            return None

    def get_screenshot_sets(self):
        return ScreenshotSet.objects.filter(test=self)

    class Meta(ScriptFile.Meta):
        unique_together = (('project', 'file_name'),)
        ordering = ['file_name']


class ScreenshotSet(IdeModel):
    test = models.ForeignKey('TestFile', related_name='screenshot_sets')
    name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_-]+$")])

    def save(self, *args, **kwargs):
        self.clean_fields()
        self.test.project.last_modified = now()
        self.test.project.save()
        super(ScreenshotSet, self).save(*args, **kwargs)

    def copy_to_directory(self, directory):
        screenshots = ScreenshotFile.objects.filter(screenshot_set=self)
        for screenshot in screenshots:
            if screenshot.platform == 'aplite':
                platform = 'tintin'
                size = '144x168'
            elif screenshot.platform == 'basalt':
                platform = 'snowy'
                size = '144x168'
            elif screenshot.platform == 'chalk':
                platform = 'snowy'
                size = '180x180'
            else:
                raise ValueError("Invalid platform")
            file_dir = os.path.join(directory, 'english', platform, size)
            file_path = os.path.join(file_dir, self.name + '.png')
            if not os.path.isdir(file_dir):
                os.makedirs(file_dir)
            screenshot.copy_to_path(file_path)

    class Meta(IdeModel.Meta):
        unique_together = (('test', 'name'),)


class ScreenshotFile(BinFile):
    bucket_name = 'source'
    folder = 'tests/screenshots'
    screenshot_set = models.ForeignKey('ScreenshotSet', related_name='files')
    PLATFORMS = (
        ('aplite', 'Aplite'),
        ('basalt', 'Basalt'),
        ('chalk', 'Chalk')
    )
    platform = models.CharField(max_length=10, choices=PLATFORMS)

    @property
    def padded_id(self):
        return '%09d' % self.id

    @property
    def s3_id(self):
        return self.id

    def save_project(self):
        self.screenshot_set.test.project.last_modified = now()
        self.screenshot_set.test.project.save()

    def save(self, *args, **kwargs):
        self.full_clean()
        self.screenshot_set.save()
        super(ScreenshotFile, self).save(*args, **kwargs)

    def save_file(self, stream, file_size=0):
        with BytesIO() as buff:
            uncorrect(stream, buff, format='png')
            buff.seek(0)
            data = buff.read()
            super(ScreenshotFile, self).save_string(data)

    class Meta(BinFile.Meta):
        unique_together = (('platform', 'screenshot_set'),)


@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender in (ScreenshotFile, TestFile, TestLog):
        if settings.AWS_ENABLED:
            try:
                s3.delete_file(sender.bucket_name, instance.s3_path)
            except:
                traceback.print_exc()
        else:
            try:
                os.unlink(instance.local_filename)
            except OSError:
                pass
