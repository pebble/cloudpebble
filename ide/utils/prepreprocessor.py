import re
import uuid
import os.path
from django.utils.translation import ugettext as _

def fix_newlines(source):
    return re.sub(r'\r\n|\r|\n', '\n', source)


def merge_newlines(source):
    return source.replace('\\\n', '')


def remove_comments(source):
    no_mutiline = re.sub(r'/\*.*?\*/', ' ', source, flags=re.DOTALL|re.MULTILINE)
    no_single_line = re.sub(r'//.*$', ' ', no_mutiline, flags=re.MULTILINE)
    return no_single_line


def extract_includes(source):
    return re.findall(r'^#\s*include\s*[<"](.+)[">]\s*$', source, flags=re.MULTILINE)


def check_include_legal(abs_dir, abs_target, include):
    path = os.path.normpath(os.path.join(abs_dir, abs_target, include))
    if not path.startswith(abs_dir):
        raise Exception(_("Illegal include '%(include)s' -> '%(path)s'") % {'include': include, 'path': path})
    return True


def process_file(abs_dir, abs_target, source):
    processed_text = remove_comments(merge_newlines(fix_newlines(source)))
    includes = extract_includes(processed_text)

    for include in includes:
        check_include_legal(abs_dir, abs_target, include)


