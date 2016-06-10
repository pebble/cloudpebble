import tempfile
import os.path


class FakeRedis(object):
    """ Essentially just a dictionary accessed via 'get' and 'set' methods """

    def __init__(self):
        self.storage = {}
        self.ex = None

    def set(self, key, value, ex=0):
        self.storage[key] = str(value)
        self.ex = ex

    def get(self, key, ex=0):
        self.ex = ex
        return self.storage.get(key, None)


class FakeS3(object):
    """ Essentially just a dictionary where the keys are tuples of (bucket_name, path) """

    def __init__(self):
        self.dict = {}
        self.last_key = None

    def reset(self):
        self.dict = {}
        self.last_key = None

    def read_file(self, bucket_name, path):
        return self.dict[(bucket_name, path)]

    def read_last_file(self):
        return self.dict[self.last_key]

    def save_file(self, bucket_name, path, value, **kwargs):
        self.dict[(bucket_name, path)] = value
        self.last_key = (bucket_name, path)

    def delete_file(self, bucket_name, path):
        del self.dict[(bucket_name, path)]

    def read_file_to_filesystem(self, bucket_name, path, destination):
        if not os.path.abspath(destination).startswith(tempfile.gettempdir()):
            raise ValueError("FakeS3 local-filesystem operations may only access temporary directories.")
        with open(destination, 'w') as f:
            f.write(self.read_file(bucket_name, path))

    def upload_file(self, bucket_name, path, src_path, **kwargs):
        if not os.path.abspath(src_path).startswith(tempfile.gettempdir()):
            raise ValueError("FakeS3 local-filesystem operations may only access temporary directories.")
        with open(src_path, 'r') as f:
            self.save_file(bucket_name, path, f.read())
