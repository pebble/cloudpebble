import re

from ide.utils.regexes import regexes


def parse_sdk_version(version):
    """ Parse an SDK compatible version string
    :param version: should be "major[.minor]"
    :return: (major, minor)
    """
    parsed = re.match(regexes.SDK_VERSION, version)
    if not parsed:
        raise ValueError("Invalid version {}".format(version))
    major = parsed.group(1)
    minor = parsed.group(3) or "0"
    return major, minor


def version_to_semver(version):
    """ Convert an SDK version string to an npm compatible semver
    :param version: should be major[.minor]
    :return: "major.minor.0"
    """
    return "{}.{}.0".format(*parse_sdk_version(version))


def parse_semver(semver):
    """ Parse a pebble/npm compatible semver
    :param semver: should be "major.minor.patch"
    :return: (major, minor)
    """
    parsed = re.match(regexes.SEMVER, semver)
    if not parsed:
        raise ValueError("Invalid semver {}".format(semver))
    return parsed.group(1), parsed.group(2), parsed.group(3)


def semver_to_version(semver):
    """ Convert a pebble/npm semver string to an SDK compatible version
    :param semver: should be major.minor.0
    :return: "major.minor"
    """
    major, minor, patch = parse_semver(semver)
    return "{}.{}".format(major, minor)
