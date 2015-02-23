import boto
from boto.s3.key import Key
from django.conf import settings
import urllib

if settings.AWS_ENABLED:
    _s3 = boto.connect_s3(settings.AWS_ACCESS_KEY_ID, settings.AWS_SECRET_ACCESS_KEY)

    _buckets = {
        'source': _s3.get_bucket(settings.AWS_S3_SOURCE_BUCKET),
        'export': _s3.get_bucket(settings.AWS_S3_EXPORT_BUCKET),
        'builds': _s3.get_bucket(settings.AWS_S3_BUILDS_BUCKET),
    }
else:
    _s3 = None
    _buckets = None


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
        headers['Content-Disposition'] = 'attachment;filename="%s"' % download_filename.replace(' ','_')

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
