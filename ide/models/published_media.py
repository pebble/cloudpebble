from django.db import models
from django.core.exceptions import ValidationError
from django.utils.translation import ugettext_lazy as _

from ide.utils.regexes import regexes
from ide.models.meta import IdeModel


class PublishedMedia(IdeModel):
    project = models.ForeignKey('Project', related_name='published_media')
    name = models.CharField(max_length=100, validators=regexes.validator('c_identifier', _('Invalid identifier')))
    media_id = models.IntegerField()
    glance = models.CharField(max_length=100, blank=True,  validators=regexes.validator('c_identifier', _('Invalid identifier')))
    has_timeline = models.BooleanField(default=False)
    timeline_tiny = models.CharField(max_length=100, blank=True, validators=regexes.validator('c_identifier', _('Invalid identifier')))
    timeline_small = models.CharField(max_length=100, blank=True, validators=regexes.validator('c_identifier', _('Invalid identifier')))
    timeline_large = models.CharField(max_length=100, blank=True, validators=regexes.validator('c_identifier', _('Invalid identifier')))

    @classmethod
    def from_dict(cls, project, data):
        obj = cls.objects.create(project=project, name=data['name'], media_id=data['id'])
        if 'glance' in data:
            obj.glance = data['glance']
        if 'timeline' in data:
            obj.timeline_tiny = data['timeline']['tiny']
            obj.timeline_small = data['timeline']['small']
            obj.timeline_large = data['timeline']['large']
        return obj

    def to_dict(self):
        obj = {
            'name': self.name,
            'id': self.media_id
        }
        if self.glance:
            obj['glance'] = self.glance
        if self.has_timeline:
            obj['timeline'] = {
                'tiny': self.timeline_tiny,
                'small': self.timeline_small,
                'large': self.timeline_large
            }
        return obj

    def clean(self):
        if self.has_timeline and self.glance and self.glance != self.timeline_tiny:
            raise ValidationError(_("If glance and timeline.tiny are both used, they must be identical."))
        if self.has_timeline and not (self.timeline_tiny and self.timeline_small and self.timeline_large):
            raise ValidationError(_("If timeline icons are enabled, they must all be set."))
        if self.media_id < 0:
            raise ValidationError(_("Published Media IDs cannot be negative."))

    class Meta(IdeModel.Meta):
        unique_together = (('project', 'name'),)
