import json
import os
import zipfile
from cStringIO import StringIO


def frame_tests_in_bundle(infile, outfile):
    """ Process monkey scripts in a test bundle
    :param infile: a test bundle - zip archive with folders each containing a test and a PBW.
    :param outfile: a copy of the test bundle with framing code added to each test file
    """
    with zipfile.ZipFile(infile, 'a') as zip_in, zipfile.ZipFile(outfile, 'w') as zip_out:
        contents = zip_in.infolist()
        tests = {}
        apps = {}
        # Make a note of any .monkey or .pbw files in the input test bundle
        # any other files are just copied to the output test bundle
        for entry in contents:
            path, filename = os.path.split(entry.filename)
            name, ext = os.path.splitext(filename)
            if ext == '.monkey':
                # Assume that the test's name is its filename (without extension)
                tests[path] = (name, entry)
            elif ext == '.pbw':
                apps[path] = entry
            else:
                zip_out.writestr(entry, zip_in.read(entry.filename))

        # For all .monkey/.pbw pairs, add test framing to the test file.
        for path in tests:
            app = apps.get(path, None)
            if app:
                app_data = zip_in.read(app)
                # Open up the PBW to read the name of the app, to use in the test script
                with zipfile.ZipFile(StringIO(app_data), 'r') as zip_pbw:
                    app_short_name = json.loads(zip_pbw.read('appinfo.json'))['shortName']
                zip_out.writestr(app, app_data)
                test_name, test_entry = tests[path]
                with zip_in.open(test_entry) as script_file:
                    framed = frame_test_file(script_file, test_name, app_short_name)
                zip_out.writestr(test_entry, framed)
            else:
                raise ValueError('Test bundle includes a test file without an accompanying PBW')


def frame_test_file(test_file, test_name, app_name):
    """ Add framing to a test file
    :param test_file: An open file-like object containing a test script
    :param test_name: Name of the test (the filename without extension or path)
    :param app_name: Name of the app to open
    :return: A string containing the framed test
    """
    test_template = """
#metadata
# {{
#   "pebble": true
# }}
#/metadata

setup {{
    context bigboard
}}

test {test_name} {{
    context bigboard

    # Load the app
    do install_app app.pbw
    do launch_app "{app_name}"
    do wait 2

{content}
}}
"""
    return test_template.format(
        test_name=test_name,
        app_name=app_name,
        content="".join('    %s' % l for l in test_file.readlines())
    )
