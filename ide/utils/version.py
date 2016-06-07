import re

# Match major[.minor], where major and minor are numbers between 0 and 255 with no leading 0s
SDK_VERSION_REGEX = r"^(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])(\.(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5]))?$"

# Match major.minor.0, where major and minor are numbers between 0 and 255 with no leading 0s
SEMVER_REGEX = r"^(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])\.(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])\.0$"


def parse_sdk_version(version):
    """ Parse an SDK compatible version string
    :param version: should be "major[.minor]"
    :return: (major, minor)
    """
    parsed = re.match(SDK_VERSION_REGEX, version)
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
    :param semver: should be "major.minor.0"
    :return: (major, minor)
    """
    parsed = re.match(SEMVER_REGEX, semver)
    if not parsed:
        raise ValueError("Invalid semver {}".format(semver))
    return parsed.group(1), parsed.group(2)


def semver_to_version(semver):
    """ Convert a pebble/npm semver string to an SDK compatible version
    :param semver: should be major.minor.0
    :return: "major.minor"
    """
    return "{}.{}".format(*parse_semver(semver))
