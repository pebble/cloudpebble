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
        var linecount = this.lineCount();
        _.each(lines, function (line) {
            if (line < linecount) {
                editor.foldCode(line, null, "fold");
            }
        });
    });
})();


CloudPebble.CodeFolds = (function () {
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

    var access_localstorage = function (callback) {
        var key = "code_folds";
        var all_folds = try_get_localstorage(key);
        if (all_folds == null) return;
        var modified = callback(_.clone(all_folds));
        if (modified !== null) {
            localStorage.setItem(key, JSON.stringify(modified));
        }
    };


    return {
        save_folds: function (code_mirror, fileid) {
            access_localstorage(function (folds) {
                folds[PROJECT_ID + "/" + fileid] = code_mirror.get_folded_lines();
                return folds;
            });
        },
        load_folds: function (code_mirror, fileid) {
            access_localstorage(function (folds) {
                lines = folds[PROJECT_ID + "/" + fileid];
                if (_.isArray(lines)) {
                    code_mirror.force_fold_lines(lines);
                }
                return null;
            });
        },
        delete_file_folds: function (code_mirror, fileid) {
            access_localstorage(function (folds) {
                delete folds[PROJECT_ID + "/" + fileid];
                return folds;
            });
        },
        delete_project_folds: function () {
            access_localstorage(function (folds) {
                _.each(folds, function(v, k) {
                    if (k.startsWith(PROJECT_ID)) {
                        delete folds[k];
                    }
                });
                return folds;
            });
        }
    }
})();
