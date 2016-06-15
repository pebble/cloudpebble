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
    """ A ProjectItem simply represents an item in a project archive which has a path
    and can be read. With custom implementations for BaseProjectItem, find_project_root_and_manifest
    is able to work identically on zip archives, git repos and automated tests """
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def read(self):
        """ This function should return the contents of the file/item as a string. """
        return None

    @abc.abstractproperty
    def path(self):
        """ This property should return the path to the item in the project. """
        return None


def is_manifest(kind, contents):
    """ A potentially valid manifest is a package.json file with a "pebble" object, or an appinfo.json file. """
    if kind == PACKAGE_MANIFEST:
        return 'pebble' in json.loads(contents)
    elif kind == APPINFO_MANIFEST:
        json.loads(contents)
        return True
    else:
        return False


def find_project_root_and_manifest(project_items):
    """ Given the contents of an archive, find a valid Pebble project.
    :param project_items: A list of BaseProjectItems
    :return: A tuple of (path_to_project, manifest BaseProjectItem)
    """
    SRC_DIR = 'src/'
    invalid_package_path = None
    for item in project_items:
        base_dir = item.path

        # Check if the file is one of the kinds of manifest file
        for name in MANIFEST_KINDS:
            dir_end = base_dir.rfind(name)
            if dir_end == -1:
                continue
            # Ensure that the file is actually a manifest file
            if dir_end + len(name) == len(base_dir):
                content = item.read()
                try:
                    if is_manifest(name, content):
                        manifest_item = item
                        break
                except ValueError as e:
                    invalid_package_path = item.path
        else:
            # If the file is not a manifest file, continue looking for the manfiest.
            continue

        # The base dir is the location of the manifest file without the manifest filename.
        base_dir = base_dir[:dir_end]

        # If we found a valid package.json, just return.
        if name == PACKAGE_MANIFEST:
            return base_dir, manifest_item

        # Otherwise if it's an appinfo.json, check that there is a a source directory containing
        # at least one source file.
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

    # If we didn't find a valid project but we did find a broken manifest file, complain about it specifically.
    if invalid_package_path:
        raise InvalidProjectArchiveException(_("The file %s does not contain a valid JSON object." % invalid_package_path))
    else:
        raise InvalidProjectArchiveException(_("No valid project root found."))
