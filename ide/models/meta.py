import shutil
import os
from django.db import models
from django.conf import settings
import utils.s3 as s3

class IdeModel(models.Model):
    class Meta:
        abstract = True
        app_label = "ide"

class TextFile(IdeModel):
    """TextFiles are database objects which can reference text files stored in S3 or locally"""
    folder = None

    def get_local_filename(self):
        padded_id = '%05d' % self.id
        return '%s%s/%s/%s/%s' % (settings.FILE_STORAGE, self.folder, padded_id[0], padded_id[1], padded_id)

    def get_s3_path(self):
        return '%s/%d' % (self.folder, self.id)

    local_filename = property(get_local_filename)
    s3_path = property(get_s3_path)

    def get_contents(self):
        if not settings.AWS_ENABLED:
            try:
                return open(self.local_filename).read()
            except IOError:
                return ''
        else:
            return s3.read_file(self.bucket_name, self.s3_path)

    def save_file(self, content):
        if not settings.AWS_ENABLED:
            if not os.path.exists(os.path.dirname(self.local_filename)):
                os.makedirs(os.path.dirname(self.local_filename))
            open(self.local_filename, 'w').write(content.encode('utf-8'))
        else:
            s3.save_file(self.bucket_name, self.s3_path, content.encode('utf-8'))

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
            s3.read_file_to_filesystem(self.bucket_name, self.s3_path, path)

    class Meta(IdeModel.Meta):
        abstract = True