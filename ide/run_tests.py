#!/ usr/bin/env python
import os
import sys

if __name__ == "__main__":
    sys.path.append("../")
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cloudpebble.settings")

    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv.append("test"))
