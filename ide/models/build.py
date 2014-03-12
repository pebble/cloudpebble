import uuid
from django.conf import settings
from django.db import models
from ide.models.project import Project

from ide.models.meta import IdeModel

__author__ = 'katharine'


class BuildResult(IdeModel):

    STATE_WAITING = 1
    STATE_FAILED = 2
    STATE_SUCCEEDED = 3
    STATE_CHOICES = (
        (STATE_WAITING, 'Pending'),
        (STATE_FAILED, 'Failed'),
        (STATE_SUCCEEDED, 'Succeeded')
    )

    project = models.ForeignKey(Project, related_name='builds')
    uuid = models.CharField(max_length=36, default=lambda:str(uuid.uuid4()))
    state = models.IntegerField(choices=STATE_CHOICES, default=STATE_WAITING)
    started = models.DateTimeField(auto_now_add=True, db_index=True)
    finished = models.DateTimeField(blank=True, null=True)

    total_size = models.IntegerField(blank=True, null=True)
    binary_size = models.IntegerField(blank=True, null=True)
    resource_size = models.IntegerField(blank=True, null=True)

    def get_dir(self):
        return '%s%s/%s/%s/' % (settings.MEDIA_ROOT, self.uuid[0], self.uuid[1], self.uuid)

    def get_url(self):
        return '%s%s/%s/%s/' % (settings.MEDIA_URL, self.uuid[0], self.uuid[1], self.uuid)

    def get_pbw_filename(self):
        return '%swatchface.pbw' % self.get_dir()

    def get_build_log(self):
        return '%sbuild_log.txt' % self.get_dir()

    def get_pbw_url(self):
        return '%swatchface.pbw' % self.get_url()

    def get_build_log_url(self):
        return '%sbuild_log.txt' % self.get_url()

    def get_debug_info_filename(self):
        return '%sdebug_info.json' % self.get_dir()

    def get_debug_info_url(self):
        return '%sdebug_info.json' % self.get_url()

    pbw = property(get_pbw_filename)
    build_log = property(get_build_log)

    pbw_url = property(get_pbw_url)
    build_log_url = property(get_build_log_url)

    debug_info = property(get_debug_info_filename)
    debug_info_url = property(get_debug_info_url)
