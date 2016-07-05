import json

import mock
from django.core.urlresolvers import reverse
from ide.utils.cloudpebble_test import CloudpebbleTestCase
from utils.fakes import FakeS3

__author__ = 'joe'

fake_s3 = FakeS3()


@mock.patch('ide.models.s3file.s3', fake_s3)
class TestSource(CloudpebbleTestCase):
    """Tests for the Tests models"""

    def setUp(self):
        self.login()

    def create_file(self, name='file.c', content=None, target=None, success=True):
        """ Create a source file """
        url = reverse('ide:create_source_file', args=[self.project_id])
        data = {}
        if name is not None:
            data['name'] = name
        if content is not None:
            data['content'] = content
        if target is not None:
            data['target'] = target
        result = json.loads(self.client.post(url, data).content)
        self.assertEqual(result['success'], success)
        if success:
            self.assertEqual(result['file']['name'], name)
            self.assertEqual(result['file']['target'], target if target else 'app')
        return result['file'] if 'file' in result else result

    def load_file(self, id, success=True):
        """ Load a source file's content """
        url = reverse('ide:load_source_file', args=[self.project_id, id])
        result = json.loads(self.client.get(url).content)
        self.assertEqual(result['success'], success)
        return result

    def rename_file(self, id, modified, old_name=None, new_name=None, success=True):
        """ Rename a source file """
        url = reverse('ide:rename_source_file', args=[self.project_id, id])
        data = {}
        if old_name is not None:
            data['old_name'] = old_name
        if new_name is not None:
            data['new_name'] = new_name
        if modified is not None:
            data['modified'] = modified
        result = json.loads(self.client.post(url, data).content)
        self.assertEqual(result['success'], success)
        return result

    def save_file(self, id, modified, content=None, folded_lines='[]', success=True):
        """ Save new content to a source file """
        data = {}
        if content is not None:
            data['content'] = content
        if folded_lines is not None:
            data['folded_lines'] = folded_lines
        if modified is not None:
            data['modified'] = modified
        url = reverse('ide:save_source_file', args=[self.project_id, id])
        result = json.loads(self.client.post(url, data).content)
        self.assertEqual(result['success'], success)

        return result

    def get_source_names(self):
        """ Get a list of project source file names """
        project = json.loads(self.client.get(reverse('ide:project_info', args=[self.project_id])).content)
        return {x['name'] for x in project['source_files']}

    def test_create(self):
        """ Test creating files in various valid states """
        self.create_file("c_file.c")
        self.create_file("js_file.js")
        self.create_file("with_content.c", content="blah" * 100)
        self.create_file("without_content.c", content=None)
        self.create_file("worker.c", target='worker')

    def test_create_load_save(self):
        """ Test a full sequence of creating, loading, saving and re-loading a file"""
        content = " Hello world ^^ "
        new_content = "New content"
        info = self.create_file(content=content)
        loaded = self.load_file(info['id'])
        self.assertEqual(content, loaded['source'])
        self.save_file(info['id'], int(loaded['modified']), content=new_content)
        loaded = self.load_file(info['id'])
        self.assertEqual(new_content, loaded['source'])

    def test_create_with_invalid_target_throws_error(self):
        """ Test that attempting to create a file with an invalid target throws an error """
        self.create_file(target='invalid', success=False)

    def test_create_with_invalid_names_throws_error(self):
        """ Check that attempts to create files with invalid names throw errors """
        self.create_file("no_extension", success=False)
        self.create_file("no_extension", success=False)
        self.create_file("bad_extension.html", success=False)
        self.create_file(".c", success=False)
        self.create_file("`unsafe characters`.c", success=False)

    def test_rename(self):
        """ Check that files can be renamed """
        name1 = "name1.c"
        name2 = "name2.c"
        info = self.create_file(name1)
        loaded = self.load_file(info['id'])
        self.rename_file(info['id'], int(loaded['modified']), name1, name2)
        self.assertIn(name2, self.get_source_names())

    def test_rename_outdated_file_fails(self):
        """ Check that a file which was modified externally fails to rename """
        name1 = "name1.c"
        name2 = "name2.c"
        info = self.create_file(name1)
        loaded = self.load_file(info['id'])
        self.rename_file(info['id'], int(loaded['modified'] - 5000), name1, name2, success=False)
        self.assertIn(name1, self.get_source_names())
