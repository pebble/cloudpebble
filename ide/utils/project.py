import logging
import abc
import json

from django.utils.translation import ugettext as _

__author__ = 'katharine'


PACKAGE_MANIFEST = 'package.json'
APPINFO_MANIFEST = 'appinfo.json'
MANIFEST_KINDS = [PACKAGE_MANIFEST, APPINFO_MANIFEST]


class InvalidProjectArchiveException(Exception):
    pass


class BaseProjectItem():
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def read(self):
        return None

    @abc.abstractproperty
    def path(self):
        return None


def is_manifest(kind, contents):
    if kind == PACKAGE_MANIFEST:
        return 'pebble' in json.loads(contents)
    elif kind == APPINFO_MANIFEST:
        return True
    else:
        return False


def find_project_root_and_manifest(project_items):
    SRC_DIR = 'src/'

    for item in project_items:
        base_dir = item.path

        # Check if the file is one of the kinds of manifest file
        for name in MANIFEST_KINDS:
            dir_end = base_dir.rfind(name)
            # Ensure that the file is actually a manifest file
            if dir_end + len(name) == len(base_dir):
                if is_manifest(name, item.read()):
                    manifest_item = item
                    break
        else:
            # If the file is not a manifest file, continue looking for the manfiest.
            continue

        # The base dir is the location of the manifest file without the manifest filename.
        base_dir = base_dir[:dir_end]

        # Now check that there is a a source directory containing at least one source file.
        for source_item in project_items:
            source_dir = source_item.path
            if source_dir[:dir_end] != base_dir:
                continue
            if not source_dir.endswith('.c') and not source_dir.endswith('.js'):
                continue
            if source_dir[dir_end:dir_end + len(SRC_DIR)] != SRC_DIR:
                continue
            break
        else:
            # If there was no source directory with a source file, keep looking for manifest files.
            continue
        return base_dir, manifest_item
    raise InvalidProjectArchiveException(_("No project root found."))
