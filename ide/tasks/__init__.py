from django.conf import settings

from ide.tasks.archive import add_project_to_archive, do_import_archive
from ide.tasks.build import run_compile
from ide.tasks.git import github_push, github_pull
from ide.tasks.gist import import_gist
import apptools.addr2lines


apptools.addr2lines.ARM_CS_TOOLS = settings.ARM_CS_TOOLS

















