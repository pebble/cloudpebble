"""
Tests in this file can be run with run_tests.py
"""

from django.test import TestCase
import git


class UrlToReposTest(TestCase):
    def test_basic_url_to_repo(self):
        """
        Tests that a simple repo url is correctly recognized.
        """
        username, reponame  = git.url_to_repo("https://github.com/pebble/cloudpebble")
        self.assertEqual("pebble", username)
        self.assertEqual("cloudpebble", reponame)

    def test_strange_url_to_repo(self):
        """
        Tests that a non-standard repo url is correctly recognized.
        """
        username, reponame  = git.url_to_repo("git://github.com:foo/bar.git")
        self.assertEqual("foo", username)
        self.assertEqual("bar", reponame)


    def test_bad_url_to_repo(self):
        """
        Tests that a entirely different url returns None.
        """
        self.assertEqual(None, git.url_to_repo("http://www.cuteoverload.com"))
