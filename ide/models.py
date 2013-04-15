from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver

import os
import os.path

class Project(models.Model):
    APP_WATCHFACE = 0
    APP_STANDARD = 1
    APP_TYPE_CHOICES = (
        (APP_WATCHFACE, 'Watchface'),
        (APP_STANDARD, 'Standard')
    )
    owner = models.ForeignKey(User)
    name = models.CharField(max_length=50)
    app_kind = models.IntegerField(choices=APP_TYPE_CHOICES, default=APP_STANDARD)
    last_modified = models.DateTimeField()
    last_compiled = models.DateTimeField(null=True, blank=True)
    last_build_successful = models.BooleanField()

    class Meta:
        unique_together = (('owner', 'name'),)

class Resource(models.Model):
    project = models.ForeignKey(Project)
    RESOURCE_KINDS = (
        'raw', 'Binary blob',
        'png', '1-bit PNG',
        'png-trans', '1-bit PNG with transparency',
        'font', 'True-Type Font'
    )
    def_name = models.CharField(max_length=100)
    file_name = models.CharField(max_length=100)
    character_regex = models.CharField(max_length=100, blank=True)

    def get_local_filename(self):
        padded_id = '%05d' % self.id
        return 'user_data/resources/%s/%s/%s' % (padded_id[0], padded_id[1], padded_id)

    local_filename = property(get_local_filename)

    class Meta:
        unique_together = (('project', 'file_name'), ('project', 'def_name'))

class SourceFile(models.Model):
    project = models.ForeignKey(Project)
    file_name = models.CharField(max_length=100)

    def get_local_filename(self):
        padded_id = '%05d' % self.id
        return 'user_data/sources/%s/%s/%s' % (padded_id[0], padded_id[1], padded_id)

    def get_contents(self):
        try:
            return open(self.local_filename).read()
        except IOError:
            return ''

    def save_file(self, content):
        if not os.path.exists(os.path.dirname(self.local_filename)):
            os.makedirs(os.path.dirname(self.local_filename))
        open(self.local_filename, 'w').write(content)

    local_filename = property(get_local_filename)

    class Meta:
        unique_together = (('project', 'file_name'))

@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender == SourceFile:
        try:
            os.unlink(instance.local_filename)
        except OSError:
            pass
