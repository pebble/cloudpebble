import re
import uuid
import os.path

def fix_newlines(source):
    return re.sub(r'\r\n|\r|\n', '\n', source)


def merge_newlines(source):
    return source.replace('\\\n', '')


def remove_comments(source):
    no_mutiline = re.sub(r'/\*.*?\*/', ' ', source, flags=re.DOTALL)
    no_single_line = re.sub(r'//.*$', ' ', no_mutiline)
    return no_single_line


def extract_includes(source):
    return [x for x in re.findall(r'^#\s*include\s*[<"](.+)[">]\s*$', source, flags=re.MULTILINE)]


def check_include_legal(include):
    prefix = '/%s/' % uuid.uuid4()
    path = os.path.normpath(os.path.join(prefix, include))
    if not path.startswith(prefix):
        raise Exception("Illegal include '%s' -> '%s'" % (include, path))
    return True


def process_file(source):
    processed_text = remove_comments(merge_newlines(fix_newlines(source)))
    includes = extract_includes(processed_text)

    for include in includes:
        check_include_legal(include)


