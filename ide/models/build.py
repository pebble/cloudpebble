import uuid
import json
import shutil
import os
import os.path
from django.conf import settings
from django.db import models
from ide.models.project import Project
from django.utils.translation import ugettext_lazy as _

from ide.models.meta import IdeModel
from ide.utils.regexes import regexes

import utils.s3 as s3
__author__ = 'katharine'


class BuildResult(IdeModel):

    STATE_WAITING = 1
    STATE_FAILED = 2
    STATE_SUCCEEDED = 3
    STATE_CHOICES = (
        (STATE_WAITING, _('Pending')),
        (STATE_FAILED, _('Failed')),
        (STATE_SUCCEEDED, _('Succeeded'))
    )

    DEBUG_INFO_MAP = {
        'aplite': ('debug_info.json', 'worker_debug_info.json'),
        'basalt': ('basalt_debug_info.json', 'basalt_worker_debug_info.json'),
        'chalk': ('chalk_debug_info.json', 'chalk_worker_debug_info.json'),
        'diorite': ('diorite_debug_info.json', 'diorite_worker_debug_info.json'),
        'emery': ('emery_debug_info.json', 'emery_worker_debug_info.json'),
    }
    DEBUG_APP = 0
    DEBUG_WORKER = 1

    project = models.ForeignKey(Project, related_name='builds')
    uuid = models.CharField(max_length=36, default=lambda: str(uuid.uuid4()), validators=regexes.validator('uuid', _('Invalid UUID.')))
    state = models.IntegerField(choices=STATE_CHOICES, default=STATE_WAITING)
    started = models.DateTimeField(auto_now_add=True, db_index=True)
    finished = models.DateTimeField(blank=True, null=True)

    def _get_dir(self):
        if settings.AWS_ENABLED:
            return '%s/' % self.uuid
        else:
            path = '%s%s/%s/%s/' % (settings.MEDIA_ROOT, self.uuid[0], self.uuid[1], self.uuid)
            if not os.path.exists(path):
                os.makedirs(path)
            return path

    def get_url(self):
        if settings.AWS_ENABLED:
            return "%s%s/" % (settings.MEDIA_URL, self.uuid)
        else:
            return '%s%s/%s/%s/' % (settings.MEDIA_URL, self.uuid[0], self.uuid[1], self.uuid)

    @property
    def pbw(self):
        return '%swatchface.pbw' % self._get_dir()

    @property
    def package(self):
        return '%spackage.tar.gz' % self._get_dir()

    @property
    def package_url(self):
        return '%spackage.tar.gz' % self.get_url()

    @property
    def build_log(self):
        return '%sbuild_log.txt' % self._get_dir()

    @property
    def pbw_url(self):
        return '%swatchface.pbw' % self.get_url()

    @property
    def build_log_url(self):
        return '%sbuild_log.txt' % self.get_url()

    @property
    def simplyjs(self):
        return '%ssimply.js' % self._get_dir()

    def get_debug_info_filename(self, platform, kind):
        return self._get_dir() + self.DEBUG_INFO_MAP[platform][kind]

    def save_build_log(self, text):
        if not settings.AWS_ENABLED:
            with open(self.build_log, 'w') as f:
                f.write(text)
        else:
            s3.save_file('builds', self.build_log, text, public=True, content_type='text/plain')

    def read_build_log(self):
        if not settings.AWS_ENABLED:
            with open(self.build_log, 'r') as f:
                return f.read()
        else:
            return s3.read_file('builds', self.build_log)

    def save_debug_info(self, json_info, platform, kind):
        text = json.dumps(json_info)
        if not settings.AWS_ENABLED:
            with open(self.get_debug_info_filename(platform, kind), 'w') as f:
                f.write(text)
        else:
            s3.save_file('builds', self.get_debug_info_filename(platform, kind), text, public=True, content_type='application/json')

    def save_package(self, package_path):
        if not settings.AWS_ENABLED:
            shutil.move(package_path, self.package)
        else:
            filename = '%s.tar.gz' % self.project.app_short_name.replace('/', '-')
            s3.upload_file('builds', self.package, package_path, public=True, download_filename=filename, content_type='application/gzip')

    def save_pbw(self, pbw_path):
        if not settings.AWS_ENABLED:
            shutil.move(pbw_path, self.pbw)
        else:
            s3.upload_file('builds', self.pbw, pbw_path, public=True, download_filename='%s.pbw' % self.project.app_short_name.replace('/','-'))

    def save_simplyjs(self, javascript):
        if not settings.AWS_ENABLED:
            with open(self.simplyjs, 'w') as f:
                f.write(javascript)
        else:
            s3.save_file('builds', self.simplyjs, javascript, public=True, content_type='text/javascript')

    def get_sizes(self):
        sizes = {}
        for size in self.sizes.all():
            sizes[size.platform] = {
                'total': size.total_size,
                'app': size.binary_size,
                'resources': size.resource_size,
                'worker': size.worker_size,
            }
        return sizes


class BuildSize(IdeModel):
    build = models.ForeignKey(BuildResult, related_name='sizes')

    platform = models.CharField(max_length=20)

    total_size = models.IntegerField(blank=True, null=True)
    binary_size = models.IntegerField(blank=True, null=True)
    resource_size = models.IntegerField(blank=True, null=True)
    worker_size = models.IntegerField(blank=True, null=True)
