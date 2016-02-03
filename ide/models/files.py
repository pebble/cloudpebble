import os
import shutil
import traceback
import datetime
import json
from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils.timezone import now
from django.core.validators import RegexValidator
from django.utils.translation import ugettext as _
import utils.s3 as s3

from ide.models.meta import IdeModel

__author__ = 'katharine'


class ResourceFile(IdeModel):
    project = models.ForeignKey('Project', related_name='resources')
    RESOURCE_KINDS = (
        ('raw', _('Binary blob')),
        ('bitmap', _('Bitmap Image')),
        ('png', _('1-bit PNG')),
        ('png-trans', _('1-bit PNG with transparency')),
        ('font', _('True-Type Font')),
        ('pbi', _('1-bit Pebble image')),
    )

    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_(). -]+$")])
    kind = models.CharField(max_length=9, choices=RESOURCE_KINDS)
    is_menu_icon = models.BooleanField(default=False)

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
        'bitmap': 'images',
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


class ResourceVariant(IdeModel):
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

    def get_tags(self):
        return [int(tag) for tag in self.tags.split(",") if tag]

    def set_tags(self, tag_ids):
        self.tags = ",".join([str(int(t)) for t in tag_ids])

    def get_tag_names(self):
        return [ResourceVariant.VARIANT_STRINGS[t] for t in self.get_tags()]

    def get_tags_string(self):
        return "".join(self.get_tag_names())

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


    class Meta(IdeModel.Meta):
        unique_together = (('resource_file', 'tags'),)


class ResourceIdentifier(IdeModel):
    resource_file = models.ForeignKey(ResourceFile, related_name='identifiers')
    resource_id = models.CharField(max_length=100)
    character_regex = models.CharField(max_length=100, blank=True, null=True)
    tracking = models.IntegerField(blank=True, null=True)
    compatibility = models.CharField(max_length=10, blank=True, null=True)
    target_platforms = models.CharField(max_length=30, null=True, blank=True, default=None)

    MEMORY_FORMATS = (
        ('Smallest', _('Smallest')),
        ('SmallestPalette', _('Smallest Palette')),
        ('1Bit', _('1-bit')),
        ('8Bit', _('8-bit')),
        ('1BitPalette', _('1-bit Palette')),
        ('2BitPalette', _('2-bit Palette')),
        ('4BitPalette', _('4-bit Palette')),
    )
    memory_format = models.CharField(max_length=15, choices=MEMORY_FORMATS, null=True, blank=True)

    STORAGE_FORMATS = (
        ('pbi', _('1 bit Pebble Image')),
        ('png', _('PNG'))
    )
    storage_format = models.CharField(max_length=3, choices=STORAGE_FORMATS, null=True, blank=True)

    SPACE_OPTIMISATIONS = (
        ('storage', _('Storage')),
        ('memory', _('Memory'))
    )
    space_optimisation = models.CharField(max_length=7, choices=SPACE_OPTIMISATIONS, null=True, blank=True)

    def get_options_dict(self, with_id=False):
        """ Return the ResourceIdentifier's options as a dictionary. Optionally include its ID in the key 'id' """
        d = {
            # Resource ID
            'target_platforms': json.loads(self.target_platforms) if self.target_platforms else None,

            # Font options
            'regex': self.character_regex,
            'tracking': self.tracking,
            'compatibility': self.compatibility,

            # Bitmap options
            'memory_format': self.memory_format,
            'storage_format': self.storage_format,
            'space_optimisation': self.space_optimisation
        }
        if with_id:
            d['id'] = self.resource_id
        return d

    def save(self, *args, **kwargs):
        self.resource_file.project.last_modified = now()
        self.resource_file.project.save()
        super(ResourceIdentifier, self).save(*args, **kwargs)


class SourceFile(IdeModel):
    project = models.ForeignKey('Project', related_name='source_files')
    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_.-]+\.(c|h|js)$")])
    last_modified = models.DateTimeField(blank=True, null=True, auto_now=True)
    folded_lines = models.TextField(default="[]")

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

    def was_modified_since(self, expected_modification_time):
        if isinstance(expected_modification_time, int):
            expected_modification_time = datetime.datetime.fromtimestamp(expected_modification_time)
        assert isinstance(expected_modification_time, datetime.datetime)
        return self.last_modified.replace(tzinfo=None, microsecond=0) > expected_modification_time

    def save_file(self, content, folded_lines=None):
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            open(self.local_filename, 'w').write(content.encode('utf-8'))
        else:
            s3.save_file('source', self.s3_path, content.encode('utf-8'))
        if folded_lines:
            self.folded_lines = folded_lines
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
        self.full_clean()
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
                s3.delete_file('source', instance.s3_path)
            except:
                traceback.print_exc()
        else:
            try:
                os.unlink(instance.local_filename)
            except OSError:
                pass
