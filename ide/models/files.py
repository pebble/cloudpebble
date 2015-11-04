import os
import shutil
import traceback
import datetime
import re
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils.timezone import now
from django.core.validators import RegexValidator
from django.utils.translation import ugettext as _
import utils.s3 as s3

from ide.models.meta import IdeModel, TextFile

__author__ = 'katharine'

class ScriptFile(TextFile):
    """ScriptFiles add support to TextFiles for last-modified timestamps and code folding"""
    last_modified = models.DateTimeField(blank=True, null=True, auto_now=True)
    folded_lines = models.TextField(default="[]")

    def was_modified_since(self, expected_modification_time):
        if isinstance(expected_modification_time, int):
            expected_modification_time = datetime.datetime.fromtimestamp(expected_modification_time)
        assert isinstance(expected_modification_time, datetime.datetime)
        return self.last_modified.replace(tzinfo=None, microsecond=0) > expected_modification_time

    def save_file(self, content, folded_lines=None):
        with transaction.atomic():
            if folded_lines:
                self.folded_lines = folded_lines
            super(ScriptFile, self).save_file(content)

    def save(self, *args, **kwargs):
        self.full_clean()
        self.project.last_modified = now()
        self.project.save()
        super(ScriptFile, self).save(*args, **kwargs)

    class Meta(IdeModel.Meta):
        abstract = True

class BinFile(IdeModel):
    bucket_name = ''
    folder = None

    def get_local_filename(self, create=False):
        padded_id = self.padded_id
        filename = '%s%s/%s/%s/%s' % (settings.FILE_STORAGE, self.folder, padded_id[0], padded_id[1], padded_id)
        if create:
            if not os.path.exists(os.path.dirname(filename)):
                os.makedirs(os.path.dirname(filename))
        return filename

    def get_s3_path(self):
        return '%s/%s' % (self.folder, self.s3_id)

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
            s3.save_file(self.bucket_name, self.s3_path, stream.read())

        self.save_project()

    def save_string(self, string):
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            with open(self.local_filename, 'wb') as out:
                out.write(string)
        else:
            s3.save_file(self.bucket_name, self.s3_path, string)

    def copy_to_path(self, path):
        if not settings.AWS_ENABLED:
            shutil.copy(self.local_filename, path)
        else:
            s3.read_file_to_filesystem(self.bucket_name, self.s3_path, path)

    def get_contents(self):
        if not settings.AWS_ENABLED:
            return open(self.local_filename).read()
        else:
            return s3.read_file(self.bucket_name, self.s3_path)

    class Meta(IdeModel.Meta):
        abstract = True


class ResourceFile(IdeModel):
    project = models.ForeignKey('Project', related_name='resources')
    RESOURCE_KINDS = (
        ('raw', _('Binary blob')),
        ('png', _('1-bit PNG')),
        ('png-trans', _('1-bit PNG with transparency')),
        ('font', _('True-Type Font')),
        ('pbi', _('1-bit Pebble image')),
    )

    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_(). -]+$")])
    kind = models.CharField(max_length=9, choices=RESOURCE_KINDS)
    is_menu_icon = models.BooleanField(default=False)
    target_platforms = models.CharField(max_length=30, null=True, blank=True, default=None)

    def get_best_variant(self, tags_string):
        try:
            return self.variants.get(tags=tags_string)
        except ResourceVariant.DoesNotExist:
            return self.get_default_variant()

    def rename(self, new_name):
        if os.path.splitext(self.file_name)[1] != os.path.splitext(new_name)[1]:
            raise Exception("Cannot change file type when renaming resource")
        self.file_name = new_name

    def get_default_variant(self):
        return self.variants.get(tags="")

    def get_identifiers(self):
        return ResourceIdentifier.objects.filter(resource_file=self)

    def copy_all_variants_to_dir(self, path):
        filename_parts = os.path.splitext(self.file_name)
        for variant in self.variants.all():
            abs_target = "%s/%s%s%s" % (path, filename_parts[0], variant.get_tags_string(), filename_parts[1])
            if not abs_target.startswith(path):
                raise Exception("Suspicious filename: %s" % self.file_name)
            variant.copy_to_path(abs_target)

    def save(self, *args, **kwargs):
        self.clean_fields()
        self.project.last_modified = now()
        self.project.save()
        super(ResourceFile, self).save(*args, **kwargs)

    DIR_MAP = {
        'pbi': 'images',
        'png': 'images',
        'png-trans': 'images',
        'font': 'fonts',
        'raw': 'data'
    }

    def get_path(self, variant):
        return self.get_best_variant(variant).get_path()

    @property
    def root_path(self):
        # Try to get the default variant and return its path
        try:
            return self.get_default_variant().root_path
        except ResourceVariant.DoesNotExist:
            # Failing that, strip the suffixes off an existing one
            return self.variants.all()[0].root_path

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'file_name'),)


class ResourceVariant(BinFile):
    bucket_name = 'source'
    resource_file = models.ForeignKey(ResourceFile, related_name='variants')

    VARIANT_DEFAULT = 0
    VARIANT_MONOCHROME = 1
    VARIANT_COLOUR = 2
    VARIANT_RECT = 3
    VARIANT_ROUND = 4
    VARIANT_APLITE = 5
    VARIANT_BASALT = 6
    VARIANT_CHALK = 7

    VARIANT_STRINGS = {
        VARIANT_MONOCHROME: '~bw',
        VARIANT_COLOUR: '~color',
        VARIANT_RECT: '~rect',
        VARIANT_ROUND: '~round',
        VARIANT_APLITE: '~aplite',
        VARIANT_BASALT: '~basalt',
        VARIANT_CHALK: '~chalk'
    }

    TAGS_DEFAULT = ""

    tags = models.CommaSeparatedIntegerField(max_length=50, blank=True)
    is_legacy = models.BooleanField(default=False)  # True for anything migrated out of ResourceFile

    def save_project(self):
        self.resource_file.project.last_modified = now()
        self.resource_file.project.save()

    def get_tags(self):
        return [int(tag) for tag in self.tags.split(",") if tag]

    def set_tags(self, tag_ids):
        self.tags = ",".join([str(int(t)) for t in tag_ids])

    def get_tag_names(self):
        return [ResourceVariant.VARIANT_STRINGS[t] for t in self.get_tags()]

    def get_tags_string(self):
        return "".join(self.get_tag_names())

    @property
    def padded_id(self):
        return '%05d' % self.resource_file.id if self.is_legacy else '%09d' % self.id

    @property
    def s3_id(self):
        return self.resource_file.id if self.is_legacy else self.id

    @property
    def folder(self):
        return 'resources' if self.is_legacy else 'resources/variants'

    def save(self, *args, **kwargs):
        self.full_clean()
        self.resource_file.save()
        super(ResourceVariant, self).save(*args, **kwargs)

    def get_path(self):
        name_parts = os.path.splitext(self.resource_file.file_name)
        return '%s/%s%s%s' % (ResourceFile.DIR_MAP[self.resource_file.kind], name_parts[0], self.get_tags_string(), name_parts[1])

    def get_root_path(self):
        name_parts = os.path.splitext(self.path)
        suffix = self.get_tags_string()
        if not name_parts[0].endswith(suffix):
            raise Exception("No root path found for resource variant %s" % self.path)
        root_path = name_parts[0][:len(name_parts[0])-len(suffix)] + name_parts[1]
        if "~" in root_path:
            raise ValueError("Filenames are not allowed to contain the tilde (~) character, except for specifying tags")
        return root_path

    path = property(get_path)
    root_path = property(get_root_path)

    class Meta(BinFile.Meta):
        unique_together = (('resource_file', 'tags'),)


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


class SourceFile(ScriptFile):
    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_-]+\.(c|h|js)$")])
    project = models.ForeignKey('Project', related_name='source_files')
    bucket_name = 'source'
    folder = 'sources'

    TARGETS = (
        ('app', _('App')),
        ('worker', _('Worker')),
    )
    target = models.CharField(max_length=10, choices=TARGETS, default='app')

    @property
    def project_path(self):
        if self.target == 'app':
            return 'src/%s' % self.file_name
        else:
            return 'worker_src/%s' % self.file_name

    class Meta(ScriptFile.Meta):
        unique_together = (('project', 'file_name'),)

class TestFile(ScriptFile):
    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_-]+$")])
    project = models.ForeignKey('Project', related_name='test_files')
    bucket_name = 'source'
    folder = 'tests/scripts'

    @property
    def project_path(self):
        return 'integration_tests/%s' % self.file_name


    @property
    def latest_code(self):
        try:
            return self.runs.latest('date_completed').code
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

    class Metha(IdeModel.Meta):
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

    class Meta(BinFile.Meta):
        unique_together = (('platform', 'screenshot_set'),)


@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if sender in (SourceFile, ResourceVariant, ScreenshotFile, TestFile):
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
