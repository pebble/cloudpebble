from unittest import TestCase

import mock

from orchestrator_proxy.utils import uuid_map
from utils.fakes import FakeRedis

fake_redis = FakeRedis()


@mock.patch('orchestrator_proxy.utils.uuid_map.redis_client', fake_redis)
class TestUUIDMap(TestCase):
    def test_create_then_get(self):
        """ Test that we can fetch a UUID mapping which we create """

        uuid = uuid_map.make_uuid('job_id')
        job_id = uuid_map.lookup_uuid(uuid)
        self.assertEqual(job_id, 'job_id')
        self.assertIsNotNone(fake_redis.ex)

    def test_reversible_mapping(self):
        """ Test that multiple make_uuid (reversible=True) calls give the same UUID """

        uuid1 = uuid_map.make_uuid('job_id', unique=True)
        uuid2 = uuid_map.make_uuid('job_id', unique=True)
        self.assertEqual(uuid1, uuid2)

    def test_notification(self):
        """ Test that you can set a job as completed """

        uuid_map.set_notified('job_id', False)
        notified = uuid_map.is_notified('job_id')
        self.assertEqual(notified, False)

        uuid_map.set_notified('job_id', True)
        notified = uuid_map.is_notified('job_id')
        self.assertEqual(notified, True)

    def test_namespacing(self):
        """ Test that namespacing correctly separates UUIDs """
        uuid = uuid_map.make_uuid('job_id', kind='a')
        with self.assertRaises(KeyError):
            uuid_map.lookup_uuid(uuid, kind='b')

    def test_preset_uuid(self):
        """ Test that a pre-generated UUID can be supplied to make_uuid """

        uuid = "abc"
        uuid_map.make_uuid('job_id', uuid=uuid)
        job_id = uuid_map.lookup_uuid(uuid)
        self.assertEqual(job_id, 'job_id')
