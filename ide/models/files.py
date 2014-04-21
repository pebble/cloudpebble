import os
import shutil
from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils.timezone import now
import utils.s3 as s3

from ide.models.meta import IdeModel

__author__ = 'katharine'


class ResourceFile(IdeModel):
    project = models.ForeignKey('Project', related_name='resources')
    RESOURCE_KINDS = (
        ('raw', 'Binary blob'),
        ('png', '1-bit PNG'),
        ('png-trans', '1-bit PNG with transparency'),
        ('font', 'True-Type Font')
    )

    file_name = models.CharField(max_length=100)
    kind = models.CharField(max_length=9, choices=RESOURCE_KINDS)
    is_menu_icon = models.BooleanField(default=False)

    def get_local_filename(self, create=False):
        padded_id = '%05d' % self.id
        filename = '%sresources/%s/%s/%s' % (settings.FILE_STORAGE, padded_id[0], padded_id[1], padded_id)
        if create:
            if not os.path.exists(os.path.dirname(filename)):
                os.makedirs(os.path.dirname(filename))
        return filename

    def get_s3_path(self):
        return 'resources/%s' % self.id

    local_filename = property(get_local_filename)
    s3_path = property(get_s3_path)

    def save_file(self, stream, file_size=0):
        if file_size > 5*1024*1024:
            raise Exception("Uploaded file too big.");
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            with open(self.local_filename, 'wb') as out:
                out.write(stream.read())
        else:
            s3.save_file('source', self.s3_path, stream.read())

        self.project.last_modified = now()
        self.project.save()

    def save_string(self, string):
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            with open(self.local_filename, 'wb') as out:
                out.write(string)
        else:
            s3.save_file('source', self.s3_path, string)

    def get_contents(self):
        if not settings.AWS_ENABLED:
            return open(self.local_filename).read()
        else:
            return s3.read_file('source', self.s3_path)

    def get_identifiers(self):
        return ResourceIdentifier.objects.filter(resource_file=self)

    def copy_to_path(self, path):
        if not settings.AWS_ENABLED:
            shutil.copy(self.local_filename, path)
        else:
            s3.read_file_to_filesystem('source', self.s3_path, path)

    def save(self, *args, **kwargs):
        self.project.last_modified = now()
        self.project.save()
        super(ResourceFile, self).save(*args, **kwargs)

    DIR_MAP = {
        'png': 'images',
        'png-trans': 'images',
        'font': 'fonts',
        'raw': 'data'
    }

    def get_path(self):
        return '%s/%s' % (self.DIR_MAP[self.kind], self.file_name)

    path = property(get_path)

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'file_name'),)


class ResourceIdentifier(IdeModel):
    resource_file = models.ForeignKey(ResourceFile, related_name='identifiers')
    resource_id = models.CharField(max_length=100)
    character_regex = models.CharField(max_length=100, blank=True, null=True)
    tracking = models.IntegerField(blank=True, null=True)

    def save(self, *args, **kwargs):
        self.resource_file.project.last_modified = now()
        self.resource_file.project.save()
        super(ResourceIdentifier, self).save(*args, **kwargs)

    class Meta(IdeModel.Meta):
        unique_together = (('resource_file', 'resource_id'),)


class SourceFile(IdeModel):
    project = models.ForeignKey('Project', related_name='source_files')
    file_name = models.CharField(max_length=100)
    last_modified = models.DateTimeField(blank=True, null=True, auto_now=True)

    def get_local_filename(self):
        padded_id = '%05d' % self.id
        return '%ssources/%s/%s/%s' % (settings.FILE_STORAGE, padded_id[0], padded_id[1], padded_id)

    def get_s3_path(self):
        return 'sources/%d' % self.id

    def get_contents(self):
        if not settings.AWS_ENABLED:
            try:
                return open(self.local_filename).read()
            except IOError:
                return ''
        else:
            return s3.read_file('source', self.s3_path)

    def save_file(self, content):
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            open(self.local_filename, 'w').write(content.encode('utf-8'))
        else:
            s3.save_file('source', self.s3_path, content.encode('utf-8'))

        self.save()

    def copy_to_path(self, path):
        if not settings.AWS_ENABLED:
            try:
                shutil.copy(self.local_filename, path)
            except IOError as err:
                if err.errno == 2:
                    open(path, 'w').close()  # create the file if it's missing.
                else:
                    raise
        else:
            s3.read_file_to_filesystem('source', self.s3_path, path)

    def save(self, *args, **kwargs):
        self.project.last_modified = now()
        self.project.save()
        super(SourceFile, self).save(*args, **kwargs)

    local_filename = property(get_local_filename)
    s3_path = property(get_s3_path)

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'file_name'))


@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender == SourceFile or sender == ResourceFile:
        try:
            os.unlink(instance.local_filename)
        except OSError:
            pass