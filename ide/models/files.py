import json
import os
import logging

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils.timezone import now
from django.utils.translation import ugettext as _


import utils.s3 as s3
from ide.models.meta import IdeModel
from ide.models.s3file import S3File
from ide.models.scriptfile import ScriptFile

__author__ = 'katharine'

logger = logging.getLogger(__name__)


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


class ResourceVariant(S3File):
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

    # The following three properties are overridden to support is_legacy
    @property
    def padded_id(self):
        return '%05d' % self.resource_file.id if self.is_legacy else '%09d' % self.id

    @property
    def s3_id(self):
        return self.resource_file.id if self.is_legacy else self.id

    @property
    def folder(self):
        return 'resources' if self.is_legacy else 'resources/variants'

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

    class Meta(S3File.Meta):
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


class SourceFile(ScriptFile):
    project = models.ForeignKey('Project', related_name='source_files')
    file_name = models.CharField(max_length=100, validators=[RegexValidator(r"^[/a-zA-Z0-9_.-]+\.(c|h|js)$")])
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
