from __future__ import unicode_literals

import codecs
import tempfile

from django.contrib.staticfiles.storage import staticfiles_storage

from pipeline.conf import settings
from pipeline.compressors import SubProcessCompressor
from pipeline.utils import source_map_re, path_depth


class ConcatenatingUglifyJSCompressor(SubProcessCompressor):
    def compress_js(self, js):
        command = [settings.UGLIFYJS_BINARY, settings.UGLIFYJS_ARGUMENTS]
        if self.verbose:
            command.append(' --verbose')
        return self.execute_command(command, js)

    def concatenate_files(self, paths, out_path):
        args = [settings.CONCATENATOR_BINARY]
        args += [staticfiles_storage.path(p) for p in paths]
        args += ['-o', out_path]
        args += ['-d', staticfiles_storage.base_location]
        self.execute_command(args)

    def compress_js_with_source_map(self, paths):
        concatenated_js_file = tempfile.NamedTemporaryFile()
        source_map_file = tempfile.NamedTemporaryFile()
        try:
            self.concatenate_files(paths, concatenated_js_file.name)
            args = [settings.UGLIFYJS_BINARY]
            args += [concatenated_js_file.name]
            args += ["--in-source-map", concatenated_js_file.name + ".map"]
            args += ["--source-map", source_map_file.name]
            args += ["--source-map-root", staticfiles_storage.base_url]
            args += ["--prefix", "%s" % path_depth(staticfiles_storage.base_location)]
            args += settings.UGLIFYJS_ARGUMENTS
            if self.verbose:
                args.append('--verbose')

            js = self.execute_command(args)

            with codecs.open(source_map_file.name, encoding='utf-8') as f:
                source_map = f.read()

            # Strip out existing source map comment (it will be re-added with packaging)
            js = source_map_re.sub('', js)

            return js, source_map
        finally:
            concatenated_js_file.close()
            source_map_file.close()
