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

    def save_file(self, bucket_name, path, value, **kwargs):
        self.dict[(bucket_name, path)] = value
        self.last_key = (bucket_name, path)

    def delete_file(self, bucket_name, path):
        del self.dict[(bucket_name, path)]

    def read_file_to_filesystem(self, bucket_name, path, destination):
        raise NotImplementedError("S3 Filesystem operations are not allowed during tests")

    def upload_file(self, bucket_name, path, src_path, **kwargs):
        raise NotImplementedError("S3 Filesystem operations are not allowed during tests")
