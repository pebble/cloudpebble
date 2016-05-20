import json

from ide.api.ycm import make_appmessage_keys_file

from ide.utils.cloudpebble_test import CloudpebbleTestCase
from ide.models.project import Project

EXPECTED_FILE = """#pragma once
#include <stdint.h>

extern uint32_t MESSAGE_KEY_ANOTHER_KEY;
extern uint32_t MESSAGE_KEY_AWESOME_KEY;
extern uint32_t MESSAGE_KEY_TEST_KEY;
"""


class TestAppmessageKeysFile(CloudpebbleTestCase):
    def setUp(self):
        self.login()
        self.project = Project.objects.get(pk=self.project_id)

    def test_no_appmessage_keys(self):
        file = make_appmessage_keys_file(self.project)
        self.assertEqual(file, '#pragma once\n#include <stdint.h>\n\n')

    def test_dict_keys(self):
        """ Check that the file is correctly generated for dict appMessage"""
        self.project.app_keys = json.dumps({
            'TEST_KEY': 4,
            'AWESOME_KEY': 5,
            'ANOTHER_KEY': 1
        })
        file = make_appmessage_keys_file(self.project)
        self.assertEqual(file, EXPECTED_FILE)

    def test_auto_assigned_keys(self):
        """ Check that the file is correctly generated for autoassigned appMessage"""
        self.project.app_keys = json.dumps([
            'TEST_KEY',
            'ANOTHER_KEY',
            'AWESOME_KEY'
        ])
        file = make_appmessage_keys_file(self.project)
        self.assertEqual(file, EXPECTED_FILE)

    def test_auto_assigned_keys_with_lengths(self):
        """ Check that the file is correctly generated for autoassigned appMessage with an array key"""
        self.project.app_keys = json.dumps([
            'TEST_KEY',
            'AWESOME_KEY[10]',
            'ANOTHER_KEY'
        ])
        file = make_appmessage_keys_file(self.project)
        self.assertEqual(file, EXPECTED_FILE)
