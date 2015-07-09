// CodeMirror addon for getting/setting a list of folded lines
(function () {
    CodeMirror.defineExtension("get_folded_lines", function () {
        var i = 0;
        var folded_line_numbers = [];
        var editor = this;
        editor.eachLine(function (line) {
            if (line.gutterMarkers != null) {
                _.each(line.gutterMarkers, function (marker, k) {
                    if ($(marker).hasClass(editor.state.foldGutter.options.indicatorFolded)) {
                        folded_line_numbers.push(i);
                    }
                });
            }
            i++;
        });
        return folded_line_numbers;
    });
    CodeMirror.defineExtension("force_fold_lines", function (lines) {
        var editor = this;
        var linecount = this.lineCount();
        _.each(lines, function (line) {
            if (line < linecount) {
                editor.foldCode(line, null, "fold");
            }
        });
    });
})();
