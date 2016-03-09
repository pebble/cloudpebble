import json
import mock
from unittest import TestCase
from orchestrator_proxy.api.get_test_info import TestInfoProcessor

PASSED_TEST_INPUT = json.loads("""{
    "_id": "56ce19f610ac580039532c8c",
    "name": "3rd party test",
    "requestor": "cloudpebble@pebble.com",
    "notifications": [],
    "suites": {},
    "submitted_time": 1456347633,
    "sw_configs": {
        "firmware": {
            "_id": "56ce19f610ac580039532c8a",
            "submitted_time": 1456347633,
            "result": "/api/download/firmware/d93cfbe274c11a1b4fe55f6bc4a8c616dcc34131.pbz",
            "fail_codes": [],
            "priority": 50,
            "commit_hash": "9f95bb5a8daf4ab264258b71f6ebcc0b5d0a5562",
            "device_type": "qemu_snowy_bb2",
            "cached": false,
            "status": "passed"
        }
    },
    "tests": {
        "omg": {
            "_id": "56ce19f610ac580039532c8b",
            "submitted_time": 1456347633,
            "result": {
                "artifacts": [
                    [
                        "/tmp/tmp9e_TX9/tmpJGZgkm_hashed.log",
                        "/api/download/media/52a0d40ef8177bccd650d37097168359c16d6fcc.log"
                    ],
                    [
                        "/tmp/tmp9e_TX9/tmpfHwwM1/tests/omg/english/snowy/144x168/one.png",
                        "/api/download/media/74265ff70c9f22ff42a60d5718b8c58aeb95373d.png"
                    ]
                ],
                "duration": 100.97341203689575,
                "ret": 0
            },
            "fail_codes": [],
            "priority": 50,
            "test_object": "56ce19f110ac580039532c89",
            "devices": {
                "firmware": "qemu_snowy_bb2"
            },
            "xfail_issues": [],
            "status": "passed"
        }
    },
    "status": "passed"
}""")

PASSED_TEST_OUTPUT = {
    'status': u'passed',
    'tests': {u'omg': {'status': u'passed',
                       'submitted_time': 1456347633,
                       'result': {
                           'duration': 100.97341203689575,
                           'artifacts': [
                               [
                                   u'/tmp/tmp9e_TX9/tmpJGZgkm_hashed.log',
                                   u'/orchestrator/artefacts/52a0d40ef8177bccd650d37097168359c16d6fcc.log'
                               ],
                               [
                                   u'/tmp/tmp9e_TX9/tmpfHwwM1/tests/omg/english/snowy/144x168/one.png',
                                   u'/orchestrator/artefacts/74265ff70c9f22ff42a60d5718b8c58aeb95373d.png'
                               ]
                           ],
                           'log': u'/orchestrator/logs/ffffffffffffffffffffffffffffffffffff',
                           'ret': 0,
                       }}},
    'platform': 'basalt',
    'submitted_time': 1456347633,
    'id': 1,
}


class TestTestInfoProcessor(TestCase):
    @mock.patch('orchestrator_proxy.api.get_test_info.uuid_map')
    def test_process_passed_test_info(self, uuid_mapper):
        """ Test that info from orchestrator is correctly filtered and processed """
        self.maxDiff = None
        uuid_mapper.make_uuid.return_value = "f"*36
        processor = TestInfoProcessor(lambda x: x)
        output = processor.process(PASSED_TEST_INPUT, 1)
        self.assertDictEqual(output, PASSED_TEST_OUTPUT)
