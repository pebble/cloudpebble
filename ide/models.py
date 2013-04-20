from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils.timezone import now

import os
import os.path
import uuid

class Project(models.Model):
    owner = models.ForeignKey(User)
    name = models.CharField(max_length=50)
    last_modified = models.DateTimeField(auto_now_add=True)
    
    def get_last_build(self):
        return self.builds.order_by('-id')[0]

    last_build = property(get_last_build)

    class Meta:
        unique_together = (('owner', 'name'),)

class BuildResult(models.Model):
    STATE_WAITING = 1
    STATE_FAILED = 2
    STATE_SUCCEEDED = 3
    STATE_CHOICES = (
        (STATE_WAITING, 'Pending'),
        (STATE_FAILED, 'Failed'),
        (STATE_SUCCEEDED, 'Succeeded')
    )

    project = models.ForeignKey(Project, related_name='builds')
    uuid = models.CharField(max_length=32, default=lambda:uuid.uuid4().hex)
    state = models.IntegerField(choices=STATE_CHOICES, default=STATE_WAITING)
    started = models.DateTimeField(auto_now_add=True, db_index=True)
    finished = models.DateTimeField(blank=True, null=True)

    def get_dir(self):
        return 'user_data/build_results/%s/%s/%s/' % (self.uuid[0], self.uuid[1], self.uuid)

    def get_pbw_filename(self):
        return '%s/watchface.pbw' % self.get_dir()

    def get_build_log(self):
        return '%s/build_log.txt' % self.get_dir()

    pbw = property(get_pbw_filename)
    build_log = property(get_build_log)

    def run_build(self):
        run_compile.apply(self.id)

class ResourceFile(models.Model):
    project = models.ForeignKey(Project)
    RESOURCE_KINDS = (
        ('raw', 'Binary blob'),
        ('png', '1-bit PNG'),
        ('png-trans', '1-bit PNG with transparency'),
        ('font', 'True-Type Font')
    )

    file_name = models.CharField(max_length=100)
    kind = models.CharField(max_length=9, choices=RESOURCE_KINDS)

    def get_local_filename(self):
        padded_id = '%05d' % self.id
        return 'user_data/resources/%s/%s/%s' % (padded_id[0], padded_id[1], padded_id)

    local_filename = property(get_local_filename)

    def save_file(self, stream):
        if not os.path.exists(os.path.dirname(self.local_filename)):
            os.makedirs(os.path.dirname(self.local_filename))
        out = open(self.local_filename, 'wb')
        for chunk in stream.chunks():
            out.write(chunk)
        out.close()

        self.project.last_modified = now()
        self.project.save()

    def get_identifiers(self):
        return ResourceIdentifier.objects.filter(resource_file=self)

    def save(self, *args, **kwargs):
        self.project.last_modified = now()
        self.project.save()
        super(ResourceFile, self).save(*args, **kwargs)

    class Meta:
        unique_together = (('project', 'file_name'),)

class ResourceIdentifier(models.Model):
    resource_file = models.ForeignKey(ResourceFile)
    resource_id = models.CharField(max_length=100)
    character_regex = models.CharField(max_length=100, blank=True, null=True)

    def save(self, *args, **kwargs):
        self.resource_file.project.last_modified = now()
        self.resource_file.project.save()
        super(ResourceIdentifier, self).save(*args, **kwargs)

    class Meta:
        unique_together = (('resource_file', 'resource_id'),)

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

        self.project.last_modified = now()
        self.project.save()

    def save(self, *args, **kwargs):
        self.project.last_modified = now()
        self.project.save()
        super(SourceFile, self).save(*args, **kwargs)

    local_filename = property(get_local_filename)

    class Meta:
        unique_together = (('project', 'file_name'))

@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender == SourceFile or sender == ResourceFile:
        try:
            os.unlink(instance.local_filename)
        except OSError:
            pass
