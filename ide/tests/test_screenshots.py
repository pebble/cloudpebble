import json
from cloudpebble_test import CloudpebbleTestCase
from django.test.utils import setup_test_environment
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import reverse

from ide.models.files import TestFile, ScreenshotSet, ScreenshotFile

__author__ = 'joe'

class ScreenshotsTests(CloudpebbleTestCase):
    def setUp(self):
        self.login()

    def make_test(self):
        url = reverse('ide:create_test_file', args=[self.project_id])
        return json.loads(self.client.post(url, {"name": "mytest"}).content)['file']['id']

    def upload_screenshots(self, test_id):
        file1 = SimpleUploadedFile("file.png", "file_content", content_type="image/png")
        file2 = SimpleUploadedFile("file.png", "file_content", content_type="image/png")

        # Make a screenshot with two files
        screenshots = [{
            "name": "Set_1",
            "files": {
                "aplite": {
                    "uploadId": 0
                },
                "basalt": {
                    "uploadId": 1
                }
            }
        }]
        # Save the screenshots
        url = reverse('ide:save_screenshots', kwargs={
            'project_id': self.project_id,
            'test_id': test_id
        })
        data = {"screenshots": json.dumps(screenshots), "files[]": [file1, file2]}
        result = json.loads(self.client.post(url, data).content)['screenshots']

        # Check from the response that they were created properly
        self.assertEqual(result[0]['name'], "Set_1")
        self.assertEqual(result[0]['id'], 1)
        self.assertGreaterEqual(result[0]['files']['basalt']['id'], 0)
        self.assertGreaterEqual(result[0]['files']['aplite']['id'], 0)

        return data, result

    def test_edit_and_load_screenshots(self):
        # Make a screenshot to play with
        test_id = self.make_test()
        data, result1 = self.upload_screenshots(test_id)

        # Delete the aplite file, change the name and add a chalk file
        screenshots = result1
        screenshots[0]["name"] = "Set_1_edited"
        del screenshots[0]['files']["aplite"]
        screenshots[0]['files']["chalk"] = {"uploadId": 0}
        url = reverse('ide:save_screenshots', args=[self.project_id, test_id])
        data = {"screenshots": json.dumps(screenshots), "files[]": [data["files[]"][0]]}
        result2 = json.loads(self.client.post(url, data).content)['screenshots']

        # Check that the name changed, the basalt file remains the same, aplite is gone, and chalk is added
        def check(result):
            self.assertEqual(result[0]['name'], "Set_1_edited")
            self.assertEqual(result1[0]['files']['basalt']['id'], result[0]['files']['basalt']['id'])
            self.assertTrue('aplite' not in result[0]['files'])
            self.assertGreaterEqual(result[0]['files']['chalk']['id'], 0)
        check(result2)

        # Now try the load URL, and re-run the above assertions
        url = reverse('ide:load_screenshots', args=[self.project_id, test_id])
        result3 = json.loads(self.client.get(url).content)["screenshots"]
        check(result3)

    def test_show_screenshot(self):
        # Test that the URL that the server gives us for a screenshot is a valid
        # URL which leads to a PNG file.
        test_id = self.make_test()
        data, result = self.upload_screenshots(test_id)
        url = result[0]['files']['aplite']['src']
        result = self.client.get(url)
        self.assertEqual(result.get('Content-Type'), 'image/png')

    def test_delete_test(self):
        # Make a test, upload some screenshots
        test_id = self.make_test()
        data, result = self.upload_screenshots(test_id)
        set_id = result[0]['id']
        file_id = result[0]['files']['aplite']['id']

        # Check everything is there
        self.assertIsInstance(TestFile.objects.get(pk=test_id), TestFile)
        self.assertIsInstance(ScreenshotSet.objects.get(pk=set_id), ScreenshotSet)
        self.assertIsInstance(ScreenshotFile.objects.get(pk=file_id), ScreenshotFile)

        # Delete the test
        url = reverse('ide:delete_source_file', kwargs={
            'project_id': self.project_id,
            'kind': 'tests',
            'file_id': test_id
        })
        self.client.post(url)

        # Check that the test, its screenshot sets and its screenshots have all been deleted
        with self.assertRaises(ObjectDoesNotExist):
            TestFile.objects.get(pk=test_id)
        with self.assertRaises(ObjectDoesNotExist):
            ScreenshotSet.objects.get(pk=set_id)
        with self.assertRaises(ObjectDoesNotExist):
            ScreenshotFile.objects.get(pk=file_id)
