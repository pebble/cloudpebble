import datetime

from django.utils.timezone import now
from django.db import models

from ide.models.s3file import S3File


class TextFile(S3File):
    """ TextFile adds support to S3File for last-modified timestamps and code folding """
    last_modified = models.DateTimeField(blank=True, null=True, auto_now=True)
    folded_lines = models.TextField(default="[]")
    _create_local_if_not_exists = True

    def was_modified_since(self, expected_modification_time):
        if isinstance(expected_modification_time, int):
            expected_modification_time = datetime.datetime.fromtimestamp(expected_modification_time)
        assert isinstance(expected_modification_time, datetime.datetime)
        return self.last_modified.replace(tzinfo=None, microsecond=0) > expected_modification_time

    def save_lines(self, folded_lines):
        if folded_lines:
            self.folded_lines = folded_lines
        else:
            self.folded_lines = "[]"
        self.save()

    def save(self, *args, **kwargs):
        self.full_clean()
        if self.project:
            self.project.last_modified = now()
            self.project.save()
        super(TextFile, self).save(*args, **kwargs)

    class Meta(S3File.Meta):
        abstract = True
