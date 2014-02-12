import subprocess
import re

from . import ARM_CS_TOOLS

class LineReader(object):
    def __init__(self, elf_path):
        self.elf = elf_path

    def _exec_tool(self):
        return subprocess.check_output([ARM_CS_TOOLS + "arm-none-eabi-objdump", "--dwarf=decodedline", self.elf])

    def get_line_listing(self):
        decoded = self._exec_tool()

        # Hack: assume that any line some text ending in .c, followed by a
        # decimal integer and a hex integer is location information.

        lines = [
            {'file': x.group(1), 'line': int(x.group(2)), 'address': int(x.group(3), 16)}
            for x in re.finditer(r"(.*\.c)\s+(\d+)\s+(0x[0-9a-f]+)", decoded, re.MULTILINE)
        ]

        files = [x.group(1) for x in re.finditer(r"^CU: (?:.*/)?(.*?\.c):$", decoded, re.MULTILINE)]

        return files, lines

    def get_compact_listing(self):
        files, lines = self.get_line_listing()

        # Now compact this into a handy compact listing (to save on file size)
        file_id_lookup = {files[x]: x for x in xrange(len(files))}

        compact_lines = [(x['address'], file_id_lookup[x['file']], x['line']) for x in lines]

        compact_lines.sort(key=lambda x: x[0])

        return {'files': files, 'lines': compact_lines}

class FunctionRange(object):
    def __init__(self, name, start, end, line=None):
        """
        Creates a representation of a function.

        @type name str
        @type start int
        @type end int
        @type line int
        """
        self.name = name
        self.start = start
        self.end = end
        self.line = line

    def __repr__(self):
        return "addr2lines.FunctionRange('%s', %s, %s, %s)" % (self.name, self.start, self.end, self.line)

class FunctionReader(object):
    """
    hello world
    """

    def __init__(self, elf_path):
        self.elf = elf_path

    def _exec_tool(self):
        return subprocess.check_output([ARM_CS_TOOLS + "arm-none-eabi-objdump", "--dwarf=info", self.elf])

    def _decode_info_fields(self, content):
        """
        Takes a string of newline separated output of a single segment
        from objdump --dwarf=info and returns a dictionary of values for
        that segment.

        @type content str
        """
        lines = content.split("\n")
        keys = {}
        for line in lines:
            line_parts = re.split(r"\s+", line.strip(), 3)
            if len(line_parts) < 4:
                continue
            keys[line_parts[1]] = line_parts[3]
        return keys


    def iter_info_groups(self):
        content = self._exec_tool()
        for match in re.finditer(r"<1><[0-9a-f]+>: Abbrev Number: \d+ \(DW_TAG_subprogram\)(.*?)<\d><[0-9a-f]+>", content, re.DOTALL):
            fields = self._decode_info_fields(match.group(1))
            if 'DW_AT_low_pc' not in fields or 'DW_AT_high_pc' not in fields or 'DW_AT_name' not in fields:
                continue
            fn_name = fields['DW_AT_name'].split(' ')[-1] # Function name is the last word in this line.
            fn_start = int(fields['DW_AT_low_pc'], 16)
            fn_end = int(fields['DW_AT_high_pc'], 16)
            fn_line = int(fields['DW_AT_decl_line']) if 'DW_AT_decl_line' in fields else None
            yield FunctionRange(fn_name, fn_start, fn_end, fn_line)

    def get_info_groups(self):
        return list(self.iter_info_groups())

def create_coalesced_group(elf):
    dict = LineReader(elf).get_compact_listing()
    dict['functions'] = sorted([(x.start, x.end, x.name, x.line) for x in FunctionReader(elf).iter_info_groups()], key=lambda x: x[0])
    return dict
