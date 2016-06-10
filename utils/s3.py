import logging

import boto
from boto.s3.key import Key
from boto.s3.connection import OrdinaryCallingFormat, NoHostProvided
from django.conf import settings

logger = logging.getLogger(__name__)


def _ensure_bucket_exists(s3, bucket):
    try:
        s3.create_bucket(bucket)
    except boto.exception.S3ResponseError:
        pass
    else:
        logger.info("Created bucket %s" % bucket)


class BucketHolder(object):
    """ The bucket holder configures s3 when it is first accessed. This cannot be done on module import due to quirks in Django's settings system.
    See: https://docs.djangoproject.com/en/dev/internals/contributing/writing-code/coding-style/#use-of-django-conf-settings """

    def __init__(self):
        self.buckets = {}
        self.configured = False
        self.s3 = None

    def configure(self):
        if settings.AWS_ENABLED:
            if settings.AWS_S3_FAKE_S3 is None:
                # The host must be manually specified in Python 2.7.9+ due to
                # https://github.com/boto/boto/issues/2836 this bug in boto with .s in
                # bucket names.
                host = settings.AWS_S3_HOST if settings.AWS_S3_HOST else NoHostProvided

                self.s3 = boto.connect_s3(
                    settings.AWS_ACCESS_KEY_ID,
                    settings.AWS_SECRET_ACCESS_KEY,
                    host=host,
                    calling_format=OrdinaryCallingFormat()
                )
            else:
                host, port = (settings.AWS_S3_FAKE_S3.split(':', 2) + [80])[:2]
                port = int(port)
                self.s3 = boto.connect_s3("key_id", "secret_key", is_secure=False, port=port,
                                          host=host, calling_format=OrdinaryCallingFormat())
                _ensure_bucket_exists(self.s3, settings.AWS_S3_SOURCE_BUCKET)
                _ensure_bucket_exists(self.s3, settings.AWS_S3_EXPORT_BUCKET)
                _ensure_bucket_exists(self.s3, settings.AWS_S3_BUILDS_BUCKET)

            self.buckets = {
                'source': self.s3.get_bucket(settings.AWS_S3_SOURCE_BUCKET),
                'export': self.s3.get_bucket(settings.AWS_S3_EXPORT_BUCKET),
                'builds': self.s3.get_bucket(settings.AWS_S3_BUILDS_BUCKET),
            }
            self.configured = True
        else:
            self.s3 = None
            self.buckets = None

    def __getitem__(self, item):
        if settings.TESTING:
            raise Exception("S3 not mocked in test!")
        if not self.configured:
            self.configure()
        return self.buckets[item]


_buckets = BucketHolder()


def _requires_aws(fn):
    if settings.AWS_ENABLED:
        return fn
    else:
        def complain(*args, **kwargs):
            raise Exception("AWS_ENABLED must be True to call %s" % fn.__name__)

        return complain


@_requires_aws
def read_file(bucket_name, path):
    bucket = _buckets[bucket_name]
    key = bucket.get_key(path)
    return key.get_contents_as_string()


@_requires_aws
def read_file_to_filesystem(bucket_name, path, destination):
    bucket = _buckets[bucket_name]
    key = bucket.get_key(path)
    key.get_contents_to_filename(destination)


@_requires_aws
def delete_file(bucket_name, path):
    bucket = _buckets[bucket_name]
    key = bucket.get_key(path)
    key.delete()


@_requires_aws
def save_file(bucket_name, path, value, public=False, content_type='application/octet-stream'):
    bucket = _buckets[bucket_name]
    key = Key(bucket)
    key.key = path

    if public:
        policy = 'public-read'
    else:
        policy = 'private'

    key.set_contents_from_string(value, policy=policy, headers={'Content-Type': content_type})


@_requires_aws
def upload_file(bucket_name, dest_path, src_path, public=False, content_type='application/octet-stream', download_filename=None):
    bucket = _buckets[bucket_name]
    key = Key(bucket)
    key.key = dest_path

    if public:
        policy = 'public-read'
    else:
        policy = 'private'

    headers = {
        'Content-Type': content_type
    }

    if download_filename is not None:
        headers['Content-Disposition'] = 'attachment;filename="%s"' % download_filename.replace(' ', '_')

    key.set_contents_from_filename(src_path, policy=policy, headers=headers)


@_requires_aws
def get_signed_url(bucket_name, path, headers=None):
    bucket = _buckets[bucket_name]
    key = bucket.get_key(path)
    url = key.generate_url(3600, response_headers=headers)
    # hack to avoid invalid SSL certs.
    if '.cloudpebble.' in url:
        url = url.replace('.s3.amazonaws.com', '')
    return url
