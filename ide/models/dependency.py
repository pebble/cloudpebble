import re

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import ugettext_lazy as _

from ide.models.meta import IdeModel


def validate_dependency_version(value):
    if hasattr(settings, 'LOCAL_DEPENDENCY_OVERRIDE'):
        return
    # Disallow paths as versions
    if re.match(r'^file:|(\.*|~)/', value):
        raise ValidationError(_("Local path dependencies are not allowed"))


class Dependency(IdeModel):
    project = models.ForeignKey('Project', related_name='dependencies')
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=2000, validators=[validate_dependency_version])

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'name'),)

