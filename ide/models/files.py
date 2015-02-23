import os
import shutil
import traceback
from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils.timezone import now
from django.utils.translation import ugettext as _
import utils.s3 as s3

from ide.models.meta import IdeModel

__author__ = 'katharine'


class ResourceFile(IdeModel):
    project = models.ForeignKey('Project', related_name='resources')
    RESOURCE_KINDS = (
        ('raw', _('Binary blob')),
        ('png', _('1-bit PNG')),
        ('png-trans', _('1-bit PNG with transparency')),
        ('font', _('True-Type Font'))
    )

    file_name = models.CharField(max_length=100)
    kind = models.CharField(max_length=9, choices=RESOURCE_KINDS)
    is_menu_icon = models.BooleanField(default=False)

    def get_best_variant(self, variant):
        try:
            return self.variants.get(variant=variant)
        except ResourceVariant.DoesNotExist:
            return self.variants.get(variant=0)

    def get_local_filename(self, variant, create=False):
        return self.get_best_variant(variant).get_local_filename(create=create)

    def get_s3_path(self, variant):
        return self.get_best_variant(variant).get_s3_path()

    def save_file(self, variant, stream, file_size=0):
        return self.get_best_variant(variant).save_file(stream, file_size=file_size)

    def save_string(self, variant, string):
        return self.get_best_variant(variant).save_string(string)

    def get_contents(self, variant):
        return self.get_best_variant(variant).get_contents()

    def get_identifiers(self):
        return ResourceIdentifier.objects.filter(resource_file=self)

    def copy_to_path(self, variant, path):
        return self.get_best_variant(variant).copy_to_path(path)

    def copy_all_variants_to_dir(self, path):
        filename_parts = os.path.splitext(self.file_name)
        for variant in self.variants.all():
            abs_target = "%s/%s%s%s" % (path, filename_parts[0], ResourceVariant.VARIANT_SUFFIXES[variant.variant], filename_parts[1])
            if not abs_target.startswith(path):
                raise Exception("Suspicious filename: %s" % self.file_name)
            variant.copy_to_path(abs_target)

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

    def get_path(self, variant):
        return self.get_best_variant(variant).get_path()

    @property
    def root_path(self):
        return self.get_best_variant(ResourceVariant.VARIANT_DEFAULT).get_path()

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'file_name'),)


class ResourceVariant(IdeModel):
    resource_file = models.ForeignKey(ResourceFile, related_name='variants')

    VARIANT_DEFAULT = 0
    VARIANT_MONOCHROME = 1
    VARIANT_COLOUR = 2

    RESOURCE_VARIANTS = (
        (VARIANT_DEFAULT, 'fallback'),
        (VARIANT_MONOCHROME, 'bw'),
        (VARIANT_COLOUR, 'colour')
    )
    variant = models.IntegerField(choices=RESOURCE_VARIANTS)
    is_legacy = models.BooleanField(default=False)  # True for anything migrated out of ResourceFile

    def get_local_filename(self, create=False):
        if self.is_legacy:
            padded_id = '%05d' % self.resource_file.id
            filename = '%sresources/%s/%s/%s' % (settings.FILE_STORAGE, padded_id[0], padded_id[1], padded_id)
        else:
            padded_id = '%09d' % self.id
            filename = '%sresources/variants/%s/%s/%s' % (settings.FILE_STORAGE, padded_id[0], padded_id[1], padded_id)
        if create:
            if not os.path.exists(os.path.dirname(filename)):
                os.makedirs(os.path.dirname(filename))
        return filename

    def get_s3_path(self):
        if self.is_legacy:
            return 'resources/%s' % self.resource_file.id
        else:
            return 'resources/variants/%s' % self.id

    local_filename = property(get_local_filename)
    s3_path = property(get_s3_path)

    def save_file(self, stream, file_size=0):
        if file_size > 5*1024*1024:
            raise Exception(_("Uploaded file too big."))
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            with open(self.local_filename, 'wb') as out:
                out.write(stream.read())
        else:
            s3.save_file('source', self.s3_path, stream.read())

        self.resource_file.project.last_modified = now()
        self.resource_file.project.save()

    def save_string(self, string):
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            with open(self.local_filename, 'wb') as out:
                out.write(string)
        else:
            s3.save_file('source', self.s3_path, string)

        self.resource_file.project.last_modified = now()
        self.resource_file.project.save()

    def copy_to_path(self, path):
        if not settings.AWS_ENABLED:
            shutil.copy(self.local_filename, path)
        else:
            s3.read_file_to_filesystem('source', self.s3_path, path)

    def get_contents(self):
        if not settings.AWS_ENABLED:
            return open(self.local_filename).read()
        else:
            return s3.read_file('source', self.s3_path)

    def save(self, *args, **kwargs):
        self.resource_file.save()
        super(ResourceVariant, self).save(*args, **kwargs)


    VARIANT_SUFFIXES = {
        0: '',
        1: '~bw',
        2: '~color'
    }

    def get_path(self):
        name_parts = os.path.splitext(self.resource_file.file_name)
        return '%s/%s%s%s' % (ResourceFile.DIR_MAP[self.resource_file.kind], name_parts[0], self.VARIANT_SUFFIXES[self.variant], name_parts[1])

    path = property(get_path)

    class Meta(IdeModel.Meta):
        unique_together = (('resource_file', 'variant'),)


class ResourceIdentifier(IdeModel):
    resource_file = models.ForeignKey(ResourceFile, related_name='identifiers')
    resource_id = models.CharField(max_length=100)
    character_regex = models.CharField(max_length=100, blank=True, null=True)
    tracking = models.IntegerField(blank=True, null=True)
    compatibility = models.CharField(max_length=10, blank=True, null=True)

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

    TARGETS = (
        ('app', _('App')),
        ('worker', _('Worker')),
    )
    target = models.CharField(max_length=10, choices=TARGETS, default='app')

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

    @property
    def project_path(self):
        if self.target == 'app':
            return 'src/%s' % self.file_name
        else:
            return 'worker_src/%s' % self.file_name

    local_filename = property(get_local_filename)
    s3_path = property(get_s3_path)

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'file_name'))


@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender == SourceFile or sender == ResourceVariant:
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