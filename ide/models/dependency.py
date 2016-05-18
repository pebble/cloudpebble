from django.db import models
from django.core.exceptions import ValidationError
from ide.models.meta import IdeModel
from django.utils.translation import ugettext_lazy as _


def validate_version(value):
    if value.strip().lower().startswith("file:"):
        raise ValidationError(_("Local path dependencies are not allowed"))


class Dependency(IdeModel):
    project = models.ForeignKey('Project', related_name='dependencies')
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=100, validators=[validate_version])

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'name'),)
