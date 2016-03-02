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
