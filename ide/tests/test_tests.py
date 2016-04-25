import json
from collections import Counter

import mock
from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import transaction
from ide.models.build import BuildResult, BuildSize
from ide.models.project import Project

from ide.utils.cloudpebble_test import CloudpebbleTestCase

__author__ = 'joe'

from utils.fakes import FakeS3

fake_s3 = FakeS3()


@mock.patch('ide.models.s3file.s3', fake_s3)
class TestsTests(CloudpebbleTestCase):
    """Tests for the Tests models"""

    def setUp(self):
        self.login()
        with transaction.atomic():
            project = Project.objects.get(id=self.project_id)
            build = BuildResult(project=project)
            build.save()
            sizes = BuildSize(platform='basalt', build=build)
            sizes.save()

    @mock.patch('ide.api.monkey.tasks')
    def add_and_run_tests(self, task_mock, names=None, run_all=True):
        task_mock.start_orchestrator_test.delay.return_value.id = 1

        url = reverse('ide:create_test_file', args=[self.project_id])
        # Insert some tests
        names = ["mytest1", "mytest2"] if names is None else names
        tests = {test['id']: test for test in
                 (json.loads(self.client.post(url, {"name": name}).content)['file'] for name in names)}
        # Start a test session
        url = reverse('ide:post_test_session', args=[self.project_id])
        if run_all:
            result = json.loads(self.client.post(url).content)
        else:
            data = {'tests': ",".join(str(t) for t in tests.keys())}
            result = self.client.post(url, data).content
            result = json.loads(result)

        result = result['session']

        # Check that the server returns a session containing all the tests we added
        run_tests = {run['test']['id']: run['test'] for run in result['runs']}
        for test_id, test in tests.iteritems():
            self.assertEqual(test['name'], run_tests[test['id']]['name'])
        return result

    def test_get_sessions(self):
        session_data = self.add_and_run_tests()
        url = reverse('ide:get_test_sessions', args=[self.project_id])
        sessions = json.loads(self.client.get(url).content)['data']
        # Check that the list of all sessions contains the session
        self.assertEqual(sessions[0]['id'], session_data['id'])

    #
    def test_get_session(self):
        session_data = self.add_and_run_tests()
        url = reverse('ide:get_test_session', args=[self.project_id, session_data['id']])
        session = json.loads(self.client.get(url).content)['data']
        # Check that we can get the test session
        self.assertEqual(session['id'], session_data['id'])

    #
    def test_run_multiple(self):
        session_data1 = self.add_and_run_tests(names=["mytest1", "mytest2"])
        session_data2 = self.add_and_run_tests(names=["mytest3", "mytest4"])
        # The second session should run all four tests
        self.assertEqual(len(session_data2['runs']), 4)

    def test_get_all_runs(self):
        # Add two tests and run, then add another two tests and run
        self.add_and_run_tests(names=["mytest1", "mytest2"])
        self.add_and_run_tests(names=["mytest3", "mytest4"])
        url = reverse('ide:get_test_runs', args=[self.project_id])

        # When we get all runs, we expect to have run the first two tests twice
        # and the second two tests once
        runs = json.loads(self.client.get(url).content)['data']
        self.assertDictEqual(dict(Counter(run['test']['name'] for run in runs)), {
            'mytest1': 2,
            'mytest2': 2,
            'mytest3': 1,
            'mytest4': 1
        })

    def test_get_runs_for_session(self):
        # Add two tests and run, then add another two tests and run
        session_data1 = self.add_and_run_tests(names=["mytest1", "mytest2"])
        session_data2 = self.add_and_run_tests(names=["mytest3", "mytest4"])
        url = reverse('ide:get_test_runs', args=[self.project_id])

        # We expect each session to run all previously added tests
        runs1 = json.loads(self.client.get(url, {'session': session_data1['id']}).content)['data']
        runs2 = json.loads(self.client.get(url, {'session': session_data2['id']}).content)['data']
        self.assertEqual(len(runs1), 2)
        self.assertEqual(len(runs2), 4)

    def test_get_runs_for_test(self):
        # Add two tests and run, then add another two tests and run
        session_data1 = self.add_and_run_tests(names=["mytest1", "mytest2"])
        session_data2 = self.add_and_run_tests(names=["mytest3", "mytest4"])
        url = reverse('ide:get_test_runs', args=[self.project_id])

        # Get details for mytest1, and mytest4. mytest1 should get run twice.
        runs1 = json.loads(self.client.get(url, {'test': session_data1['runs'][0]['test']['id']}).content)['data']
        runs2 = json.loads(self.client.get(url, {'test': session_data2['runs'][-1]['test']['id']}).content)['data']
        self.assertEqual(len(runs1), 2)
        self.assertEqual(len(runs2), 1)

    def test_list_tests(self):
        # Make a collection of test files
        post_url = reverse('ide:create_test_file', args=[self.project_id])
        ids = sorted(
            [int(json.loads(self.client.post(post_url, {"name": "mytest" + str(x)}).content)['file']['id']) for x in
             range(5)])

        # Get the list test files
        url = reverse('ide:get_test_list', args=[self.project_id])
        response = sorted([int(t['id']) for t in json.loads(self.client.get(url).content)['tests']])

        # Check that all IDs are present
        self.assertEqual(ids, response)

    def test_notify_test_session(self):
        """ Create a test and run it. Notify cloudpebble that the test has been completed with a log. Check the test
        run's final code and log file."""

        def run_test(status='passed', result_code=1, passes=1, fails=0):
            session_data = self.add_and_run_tests(names=["mytest_%s" % status], run_all=False)
            notify_url = reverse('ide:notify_test_session', args=[self.project_id, session_data['id']])
            notify_result = json.loads(self.client.post(notify_url, {
                'log': 'The log',
                'status': status,
                'token': settings.QEMU_LAUNCH_AUTH_HEADER
            }).content)
            self.assertEqual(notify_result['success'], True)
            get_url = reverse('ide:get_test_session', args=[self.project_id, session_data['id']])
            session_result = json.loads(self.client.get(get_url).content)['data']
            self.assertEqual(session_result['passes'], passes)
            self.assertEqual(session_result['fails'], fails)
            self.assertEqual(session_result['run_count'], 1)
            runs_url = reverse('ide:get_test_runs', args=[self.project_id])
            runs_result = json.loads(self.client.get(runs_url, {'session': session_result['id']}).content)['data'][0]
            self.assertEqual(runs_result['code'], result_code)
            logs_result = self.client.get(runs_result['logs']).content
            self.assertEqual(logs_result, "The log")

        run_test(status='passed', result_code=1, passes=1, fails=0)
        run_test(status='failed', result_code=-1, passes=0, fails=1)
        run_test(status='error', result_code=-2, passes=0, fails=1)
