// CodeMirror addon for getting/setting a list of folded lines
(function () {
    CodeMirror.defineExtension("get_folded_lines", function () {
        var i = 0;
        var folded_line_numbers = [];
        var editor = this;
        editor.eachLine(function (line) {
            console.log(i);
            if (line.gutterMarkers != null) {
                _.each(line.gutterMarkers, function (marker, k) {
                    console.log(marker, k);
                    if ($(marker).hasClass(editor.state.foldGutter.options.indicatorFolded)) {
                        console.log("adding line", i);
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
        _.each(lines, function (line) {
            editor.foldCode(line, null, "fold");
        });
    });
})();

// CodeMirror addon for saving code folds in local storage
(function() {
    var try_get_localstorage = function (ls_key) {
        var test = '__ls_test__';
        try {
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            var folds = JSON.parse(localStorage.getItem(ls_key));
            if (!_.isObject(folds)) {
                folds = {};
                localStorage.setItem(ls_key, '{}');
            }
            return folds;
        } catch (e) {
            return null;
        }
    };

    CodeMirror.defineExtension("localStorage_save_folds", function(file_key, ls_key) {
        ls_key = (_.isString(ls_key) ? ls_key : "code_folds");
        if ((all_folds = try_get_localstorage(ls_key)) == null) return;
        all_folds[file_key] = this.get_folded_lines();;
        localStorage.setItem(ls_key, JSON.stringify(all_folds));
    });

    CodeMirror.defineExtension("localStorage_load_folds", function(file_key, ls_key) {
        ls_key = (_.isString(ls_key) ? ls_key : "code_folds");
        if ((all_folds = try_get_localstorage(ls_key)) == null) return;
        lines = all_folds[file_key];
        if (_.isArray(lines)) {
            this.force_fold_lines(lines);
        }
    });
})();
