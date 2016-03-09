import mock
from orchestrator_proxy.api.post_test import post_archive
from unittest import TestCase


class TestFilterDict(TestCase):
    @mock.patch('orchestrator_proxy.api.post_test.uuid4')
    @mock.patch('orchestrator_proxy.api.post_test.uuid_map')
    @mock.patch('orchestrator_proxy.api.post_test.orchestrator')
    @mock.patch('orchestrator_proxy.api.post_test.frame_tests_in_bundle')
    def test_post_archive(self, frame_tests_in_bundle, orchestrator, uuid_mapper, uuid4):
        """ Test that post_archive posts an archive correctly """
        # Set up parameters
        uuid = 'private_uuid'
        bundle_url = 'budle_url'
        job_id = 'a_job_id'
        email_address = 'an.email.address'
        platform = 'basalt'
        fake_file = 'file'

        def builder(x):
            return "url:" + x

        # Set up return values
        uuid4.return_value = uuid
        orchestrator.upload_test.return_value = bundle_url
        orchestrator.submit_test.return_value.json.return_value = {"job_id": job_id}
        uuid_mapper.make_uuid.return_value = "public_uuid"

        # Run the function and check that it returns a dict containing the right job ID
        result = post_archive(fake_file, platform, email=email_address, notify_url_builder=builder)
        expected = uuid_mapper.make_uuid.return_value
        self.assertEqual(result, expected)

        # Check that it actually made a bundle, submitted a test and made a UUID for it
        frame_tests_in_bundle.assert_called_with(fake_file, mock.ANY)
        orchestrator.submit_test.assert_called_with(
            bundle_url,
            platform=platform,
            job_name='3rd Party Test for %s' % email_address,
            notify_url=builder(uuid))
        uuid_mapper.make_uuid.assert_called_with(job_id)

    @mock.patch('orchestrator_proxy.api.post_test.orchestrator.upload_test')
    def test_invalid_platform(self, upload_test):
        """ Test that post_archive only accepts valid platforms """
        with self.assertRaises(ValueError):
            post_archive('file', 'invalid', notify_url_builder=lambda x: x)
            print upload_test.called
            self.assertFalse(upload_test.called)
