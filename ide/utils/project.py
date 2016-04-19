import logging

from django.utils.translation import ugettext as _

__author__ = 'katharine'

logger = logging.getLogger(__name__)


def find_project_root(contents):
    MANIFEST = 'appinfo.json'
    SRC_DIR = 'src/'
    for base_dir in contents:
        logger.debug("base_dir: %s", base_dir)
        try:
            dir_end = base_dir.index(MANIFEST)
            logger.debug("dir_end: %s", dir_end)
        except ValueError:
            continue
        else:
            if dir_end + len(MANIFEST) != len(base_dir):
                logger.debug('failed')
                continue

        base_dir = base_dir[:dir_end]
        logger.debug("base_dir: %s", base_dir)
        for source_dir in contents:
            if source_dir[:dir_end] != base_dir:
                continue
            if not source_dir.endswith('.c') and not source_dir.endswith('.js'):
                continue
            if source_dir[dir_end:dir_end + len(SRC_DIR)] != SRC_DIR:
                continue
            break
        else:
            continue
        break
    else:
        raise Exception(_("No project root found."))
    return base_dir
