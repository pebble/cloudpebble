from utils.monkeyscript_helpers import frame_test_file, frame_tests_in_bundle
from zipfile import ZipFile
import json
# from cStringIO import StringIO
from io import BytesIO
from unittest import TestCase

EXPECTED_TEST_FILE = """
#metadata
# {
#   "pebble": true
# }
#/metadata

setup {
    context bigboard
    do factory_reset
}

test test {
    context bigboard

    # Load the app
    do install_app app.pbw
    do launch_app "MyApp"
    do wait 2
    do set_time 1470000000
}
"""


class TestFilterDict(TestCase):
    @staticmethod
    def build_bundle():
        """ Build a minimal test bundle with a test which can be framed.
        :rtype: BytesIO
        """
        bundle = BytesIO()
        pbw = BytesIO()
        with ZipFile(pbw, mode='w') as pbw_zip:
            pbw_zip.writestr('appinfo.json', json.dumps({'shortName': 'MyApp'}))
        pbw.seek(0)
        with ZipFile(bundle, mode='w') as bundle_zip:
            bundle_zip.writestr("app.pbw", pbw.read())
            bundle_zip.writestr("test.monkey", "do set_time 1470000000")
        bundle.seek(0)
        return bundle

    def test_frame_test_file(self):
        """ Test that test file framing produces the expected output """
        f = BytesIO("do set_time 1470000000")
        output = frame_test_file(f, test_name="test", app_name="MyApp")
        self.assertEqual(output, EXPECTED_TEST_FILE)

    def test_frame_tests_in_bundle(self):
        """ Test that frame_tests_in_bundle correctly modifies the test file in the minimal test bundle"""
        infile = self.build_bundle()
        outfile = BytesIO()
        frame_tests_in_bundle(infile, outfile)
        outfile.seek(0)
        with ZipFile(outfile, mode='r') as bundle:
            self.assertEqual(EXPECTED_TEST_FILE, bundle.read('test.monkey'))
