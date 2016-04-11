import logging

from django.utils.translation import ugettext as _
from django.conf import settings
from django.utils.timezone import now
from django.db.models.signals import post_delete
from django.dispatch import receiver

import utils.s3 as s3
from ide.models.meta import IdeModel

logger = logging.getLogger(__name__)


class S3File(IdeModel):
    bucket_name = 'source'
    folder = None
    project = None

    @property
    def padded_id(self):
        return '%05d' % self.id

    @property
    def local_filename(self):
        padded_id = self.padded_id
        return '%s%s/%s/%s/%s' % (settings.FILE_STORAGE, self.folder, padded_id[0], padded_id[1], padded_id)

    @property
    def s3_id(self):
        return self.id

    @property
    def s3_path(self):
        return '%s/%s' % (self.folder, self.s3_id)

    def get_contents(self):
        return s3.read_file(self.bucket_name, self.s3_path)

    def save_string(self, string):
        s3.save_file(self.bucket_name, self.s3_path, string)
        if self.project:
            self.project.last_modified = now()
            self.project.save()

    def save_file(self, stream, file_size=0):
        if file_size > 5 * 1024 * 1024:
            raise Exception(_("Uploaded file too big."))
        self.save_string(stream.read())

    def save_text(self, content):
        self.save_string(content.encode('utf-8'))

    def copy_to_path(self, path):
        s3.read_file_to_filesystem(self.bucket_name, self.s3_path, path)

    class Meta(IdeModel.Meta):
        abstract = True


@receiver(post_delete)
def delete_file(sender, instance, **kwargs):
    if issubclass(sender, S3File):
        try:
            s3.delete_file(sender.bucket_name, instance.s3_path)
        except:
            logger.exception("Failed to delete S3 file")
