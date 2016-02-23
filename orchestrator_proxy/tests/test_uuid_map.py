from unittest import TestCase

import mock

from orchestrator_proxy.tests.fakes import FakeRedis
from orchestrator_proxy.utils import uuid_map


class TestUUIDMap(TestCase):
    def setUp(self):
        self.fake_redis = FakeRedis()

    def test_create_then_get(self):
        """ Test that we can fetch a UUID mapping which we create """
        with mock.patch('orchestrator_proxy.utils.uuid_map.redis_client', self.fake_redis):
            uuid = uuid_map.make_uuid('job_id', 'job')
            job_id = uuid_map.lookup_uuid(uuid, 'job')
            self.assertEqual(job_id, 'job_id')
            self.assertIsNotNone(self.fake_redis.ex)

    def test_create_then_create(self):
        """ Test that multiple make_uuid calls give the same UUID """
        with mock.patch('orchestrator_proxy.utils.uuid_map.redis_client', self.fake_redis):
            uuid1 = uuid_map.make_uuid('job_id', 'job')
            uuid2 = uuid_map.make_uuid('job_id', 'job')
            self.assertEqual(uuid1, uuid2)
