""" These tests check that the Project model behaves as expected."""
from ide.models import Project
from django.test import TestCase


class TestProjectModel(TestCase):
    def test_uses_array_message_keys_property(self):
        """ Check that uses_array_message_keys functions as intended """
        self.assertTrue(Project(app_keys="[]").uses_array_message_keys)
        self.assertFalse(Project(app_keys="{}").uses_array_message_keys)
