import os
from io import BytesIO
from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import RegexValidator
from django.db import models
from django.db import transaction
from django.utils.timezone import now
from django.utils.translation import ugettext as _

from django.core.urlresolvers import reverse
from ide.models.scriptfile import ScriptFile
from ide.models.s3file import S3File
from ide.models.meta import IdeModel
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
    kind = models.CharField(max_length=5, choices=SESSION_KINDS)

    @property
    def tests(self):
        return {run.test for run in self.runs.all()}

    @property
    def platforms(self):
        return {run.platform for run in self.runs.all()}

    def make_callback_url(self, request, token):
        """
        Return a function which will take a test session and return the URL which orchestrator needs to notify
        CloudPebble that the test is complete
        :param request: A Django request object
        :param token: The access token
        """
        location = request.build_absolute_uri(reverse('ide:notify_test_session', args=[self.project.pk, self.id]))
        # TODO: simple concatenation might not be the best thing here
        return location + ("?token=%s" % token if token else "")

    @staticmethod
    def setup_session(project, test_ids, platforms, kind):
        """ Make a test session which has a test run for each platform for each test ID
        :param project: Project which the session is for
        :param test_ids: List of test IDs (integers)
        :param platforms: An iterable of string platform names (e.g. ['basalt', 'chalk'])
        :param kind: Either 'live' or 'batch'.
        :return: The newly created session object.
        """
        if test_ids is not None:
            tests = TestFile.objects.filter(project=project, id__in=test_ids)
        else:
            tests = project.test_files.all()

        assert kind in dict(TestSession.SESSION_KINDS).keys()

        with transaction.atomic():
            # Create a test session
            session = TestSession.objects.create(project=project, kind=kind)
            session.save()
            runs = []

            # Then make a test run for every test
            for platform in platforms:
                assert platform in [x[0] for x in TestRun.PLATFORM_CHOICES]
                for test in tests:
                    run = TestRun.objects.create(session=session, test=test, platform=platform,
                                                 original_name=test.file_name)
                    run.save()
                    runs.append(run)
        return session

    def fail(self, message="An unknown error occurred", date=None):
        """ Mark all pending tests as failed.
        :param message: The log message for the failure
        :param date: Specify the completion date, defaults to now.
        """
        with transaction.atomic():
            for run in self.runs.filter(code=0):
                run.code = TestCode.ERROR
                run.log = message
                run.date_completed = date if date is not None else now()
                run.save()

    class Meta(IdeModel.Meta):
        ordering = ['-date_added']


class TestLog(S3File):
    """ A TestLog is a text file owned by a TestRun. It stores the console output from an AT process. """
    folder = 'tests/logs'
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
    PLATFORM_CHOICES = (
        ('aplite', 'Aplite'),
        ('basalt', 'Basalt'),
        ('chalk', 'Chalk')
    )
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES)

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
            logfile.save_text(value)

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
        unique_together = ('test', 'session', 'platform')
        ordering = ['original_name', '-session__date_added']


class TestFile(ScriptFile):
    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_-]+$")])
    project = models.ForeignKey('Project', related_name='test_files')
    folder = 'tests/scripts'
    target = 'test'

    def copy_screenshots_to_directory(self, directory):
        for screenshot_set in self.get_screenshot_sets():
            screenshot_set.copy_to_directory(directory)

    def copy_test_to_path(self, path, frame_test=True):
        self.copy_to_path(path)
        if frame_test:
            with open(path, 'r+') as f:
                full_test = frame_test_file(f, self.file_name, self.project.app_short_name, self.project.app_uuid)
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


class ScreenshotFile(S3File):
    folder = 'tests/screenshots'
    screenshot_set = models.ForeignKey('ScreenshotSet', related_name='files')
    PLATFORMS = (
        ('aplite', 'Aplite'),
        ('basalt', 'Basalt'),
        ('chalk', 'Chalk')
    )
    platform = models.CharField(max_length=10, choices=PLATFORMS)

    @property
    def project(self):
        return self.screenshot_set.test.project

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

    class Meta(S3File.Meta):
        unique_together = (('platform', 'screenshot_set'),)

