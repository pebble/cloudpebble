import mock
from orchestrator_proxy.api.post_test import post_archive
from unittest import TestCase



class TestFilterDict(TestCase):
    @mock.patch('orchestrator_proxy.api.post_test.uuid_map')
    @mock.patch('orchestrator_proxy.api.post_test.orchestrator')
    @mock.patch('orchestrator_proxy.api.post_test.frame_tests_in_bundle')
    def test_post_archive(self, frame_tests_in_bundle, orchestrator, uuid_mapper):
        """ Test that post_archive  """
        # Set up return values
        orchestrator.upload_test.return_value = 'bundle_url'
        orchestrator.submit_test.return_value.json.return_value = {"job_id": "a_job_id"}
        uuid_mapper.make_uuid.return_value = "f"*36

        # Run the function and check that it returns a dict containing the right job ID
        result = post_archive("A file")
        expected = {'job_id': uuid_mapper.make_uuid.return_value}
        self.assertDictEqual(result, expected)

        # Check that it actually made a bundle, submitted a test and made a UUID for it
        frame_tests_in_bundle.assert_called_with("A file", mock.ANY)
        orchestrator.submit_test.assert_called_with('bundle_url', job_name=mock.ANY)
        uuid_mapper.make_uuid.assert_called_with('a_job_id')
