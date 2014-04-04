import os
import shutil
import uuid

__author__ = 'katharine'


def link_or_copy(src, dst):
    try:
        os.link(src, dst)
    except OSError as e:
        if e.errno == 18:
            shutil.copy(src, dst)
        else:
            raise


def generate_half_uuid():
    _uuid = str(uuid.uuid4())
    if int(_uuid.split('-')[0], 16) > (0xffffffff/2):
        # Only take uuids from the bottom half of the uuid space
        uuid_bytes = 0xffffffff - int(_uuid[0:8], 16)
        _uuid = ''.join(["%08x" % uuid_bytes, _uuid[8:]])
    return _uuid