import shutil
import uuid

from django.contrib.auth.models import User
from django.db import models
from django.utils.translation import ugettext as _

from ide.models.files import ResourceFile, ResourceIdentifier, SourceFile, ResourceVariant
from ide.utils import generate_half_uuid

from ide.models.meta import IdeModel

__author__ = 'katharine'


class Project(IdeModel):
    owner = models.ForeignKey(User)
    name = models.CharField(max_length=50)
    last_modified = models.DateTimeField(auto_now_add=True)

    PROJECT_TYPES = (
        ('native', _('Pebble C SDK')),
        ('simplyjs', _('Simply.js')),
        ('pebblejs', _('Pebble.js (beta)')),
    )
    project_type = models.CharField(max_length=10, choices=PROJECT_TYPES, default='native')

    SDK_VERSIONS = (
        ('2', _('SDK 2 (Pebble, Pebble Steel)')),
        ('3', _('SDK 3 beta (Pebble Time)')),
    )
    sdk_version = models.CharField(max_length=6, choices=SDK_VERSIONS, default='2')

    # New settings for 2.0
    app_uuid = models.CharField(max_length=36, blank=True, null=True, default=generate_half_uuid)
    app_company_name = models.CharField(max_length=100, blank=True, null=True)
    app_short_name = models.CharField(max_length=100, blank=True, null=True)
    app_long_name = models.CharField(max_length=100, blank=True, null=True)
    app_version_label = models.CharField(max_length=40, blank=True, null=True, default='1.0')
    app_is_watchface = models.BooleanField(default=False)
    app_is_hidden = models.BooleanField(default=False)
    app_is_shown_on_communication = models.BooleanField(default=False)
    app_capabilities = models.CharField(max_length=255, blank=True, null=True)
    app_keys = models.TextField(default="{}")
    app_jshint = models.BooleanField(default=True)
    app_platforms = models.TextField(max_length=255, blank=True, null=True)
    app_modern_multi_js = models.BooleanField(default=True)

    app_capability_list = property(lambda self: self.app_capabilities.split(','))
    app_platform_list = property(lambda self: self.app_platforms.split(',') if self.app_platforms else [])

    OPTIMISATION_CHOICES = (
        ('0', 'None'),
        ('1', 'Limited'),
        ('s', 'Prefer smaller'),
        ('2', 'Prefer faster'),
        ('3', 'Aggressive (faster, bigger)'),
    )

    optimisation = models.CharField(max_length=1, choices=OPTIMISATION_CHOICES, default='s')

    github_repo = models.CharField(max_length=100, blank=True, null=True)
    github_branch = models.CharField(max_length=100, blank=True, null=True)
    github_last_sync = models.DateTimeField(blank=True, null=True)
    github_last_commit = models.CharField(max_length=40, blank=True, null=True)
    github_hook_uuid = models.CharField(max_length=36, blank=True, null=True)
    github_hook_build = models.BooleanField(default=False)

    def get_last_build(self):
        try:
            return self.builds.order_by('-id')[0]
        except IndexError:
            return None

    def get_menu_icon(self):
        try:
            return self.resources.filter(is_menu_icon=True)[0]
        except IndexError:
            return None

    def has_platform(self, platform):
        return self.app_platforms is None or platform in self.app_platform_list

    last_build = property(get_last_build)
    menu_icon = property(get_menu_icon)

    def __unicode__(self):
        return u"%s" % self.name


class TemplateProject(Project):
    KIND_TEMPLATE = 1
    KIND_SDK_DEMO = 2
    KIND_CHOICES = (
        (KIND_TEMPLATE, _('Template')),
        (KIND_SDK_DEMO, _('SDK Demo')),
    )

    template_kind = models.IntegerField(choices=KIND_CHOICES, db_index=True)

    def copy_into_project(self, project):
        uuid_string = ", ".join(["0x%02X" % ord(b) for b in uuid.uuid4().bytes])
        for resource in self.resources.all():
            new_resource = ResourceFile.objects.create(project=project, file_name=resource.file_name, kind=resource.kind)
            for variant in resource.variants.all():
                new_variant = ResourceVariant.objects.create(resource_file=new_resource, tags=variant.tags)
                new_variant.save_string(variant.get_contents())
            for i in resource.identifiers.all():
                ResourceIdentifier.objects.create(
                    resource_file=new_resource,
                    resource_id=i.resource_id,
                    character_regex=i.character_regex,
                    tracking=i.tracking,
                    compatability=i.compatibility,
                    target_platforms=i.target_platforms,
                    memory_format=i.memory_format,
                    storage_format=i.storage_format,
                    space_optmization=i.space_optimisation
                )

        for source_file in self.source_files.all():
            new_file = SourceFile.objects.create(project=project, file_name=source_file.file_name)
            new_file.save_file(source_file.get_contents().replace("__UUID_GOES_HERE__", uuid_string))

        # Copy over relevant project properties.
        # NOTE: If new, relevant properties are added, they must be copied here.
        # todo: can we do better than that? Maybe we could reuse the zip import mechanism or something...
        project.app_capabilities = self.app_capabilities
        project.app_is_watchface = self.app_is_watchface
        project.app_is_hidden = self.app_is_hidden
        project.app_is_shown_on_communication = self.app_is_shown_on_communication
        project.app_keys = self.app_keys
        project.app_jshint = self.app_jshint
        project.app_modern_multi_js = self.app_modern_multi_js
        project.save()
