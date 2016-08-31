import abc
import json
import os

from django.utils.translation import ugettext as _

__author__ = 'katharine'

SRC_DIR = 'src'
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


def rank_manifest_path(dirname, kind):
    """ Sort key for manifest files. Sort first by depth and add a penalty for being an appinfo.json """
    return os.path.normpath(dirname).count('/') + (0.5 if kind == APPINFO_MANIFEST else 0)


def find_project_root_and_manifest(project_items):
    """ Given the contents of an archive, find a (potentially) valid Pebble project.
    A potentially valid Pebble project is either:
      - An appinfo.json file next to an 'src/' directory which contains app sources
      - A package.json file which has a 'pebble' key.
    The function chooses the most shallow possible project and prefers package.json to appinfo.json if both are present.
    :param project_items: A list of BaseProjectItems
    :return: A tuple of (path_to_project, manifest BaseProjectItem)
    """
    found_manifests = set()
    found_src_files = set()

    for item in project_items:
        item_path = item.path

        # If the item looks like a manifest, add it to a set of potential manifests
        item_dirname, item_basename = os.path.split(item_path)
        if (item_basename == PACKAGE_MANIFEST and 'pebble' in json.loads(item.read())) or item_basename == APPINFO_MANIFEST:
            found_manifests.add(((item_dirname, item_basename), item))
            continue

        # Otherwise, add it to a set of source files if it is one.
        if item_path.endswith(('.c', '.js', '.h')):
            found_src_files.add(item_path)

    # Choose the most shallow manifest file which has a non-empty source directory.
    sorted_manifests = sorted(found_manifests, key=lambda x: rank_manifest_path(*x[0]))
    for (base, kind), item in sorted_manifests:
        if kind == "package.json":
            return os.path.join(base, ''), item
        src_dir = os.path.join(base, SRC_DIR, '')
        for src_path in found_src_files:
            if src_path.startswith(src_dir):
                return os.path.join(base, ''), item
    raise InvalidProjectArchiveException(_("No project root found."))
