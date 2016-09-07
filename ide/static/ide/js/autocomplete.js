CloudPebble.Editor.Autocomplete = new (function() {
    var self = this;
    var Pos = CodeMirror.Pos;

    var mSelectionCallback = null;

    var preventIncludingQuotes = function(old_selection, expected_text, cm, selection) {
        selection = selection.ranges[0];
        cm.off('beforeSelectionChange', mSelectionCallback);
        var text = cm.getRange(selection.anchor, selection.head);
        var old_text = cm.getRange(old_selection.from, old_selection.to);
        if (old_text == expected_text) {
            createMark(cm, old_selection.from, old_selection.to);
        } else if ((text[0] == "'" && text[text.length - 1] == "'") || (text[0] == '"' && text[text.length - 1] == '"')) {
            selection.anchor.ch += 1;
            selection.head.ch -= 1;
        }
    };

    var selectPlaceholder = function(cm, pos) {
        var expected_text = cm.getRange(pos.from, pos.to);
        cm.setSelection(pos.from, pos.to);
        mSelectionCallback = function(cm, selection) {
            preventIncludingQuotes(pos, expected_text, cm, selection);
        };
        cm.on('beforeSelectionChange', mSelectionCallback);
    };

    var createMark = function(cm, from, to) {
        var mark = cm.markText(from, to, {
            className: 'cm-autofilled',
            inclusiveLeft: false,
            inclusiveRight: false,
            atomic: true,
            startStyle: 'cm-autofilled-start',
            endStyle: 'cm-autofilled-end'
        });
        CodeMirror.on(mark, 'beforeCursorEnter', function() {
            var pos = mark.find();
            mark.clear();
            // Hack because we can't modify editor state from in here.
            // 50ms because that seems to let us override cursor input, too.
            setTimeout(function() { selectPlaceholder(cm, pos); }, 50);
        });
        return mark;
    };

    var expandCompletion = function(cm, data, completion) {
        // Easy part.
        cm.replaceRange(completion.text, data.from, data.to);
        // Now we get to figure out where precisely the params should have ended up and fix that.
        var start = data.from.ch + completion.name.length + 1; // +1 for open paren
        var orig_start = start;
        var first_pos = null;
        var first_mark = null;
        $.each(completion.params, function(index, value) {
            var p = [{line: data.from.line, ch: start}, {line: data.from.line, ch: start + value.length}];
            var mark = createMark(cm, p[0], p[1]);
            if (first_pos === null) first_pos = p;
            if (first_mark === null) first_mark = mark;
            start += value.length + 2;
        });
        if (first_pos === null) {
            cm.setSelection({ch: orig_start, line: data.from.line});
        } else {
            first_mark.clear();
            selectPlaceholder(cm, {from: first_pos[0], to: first_pos[1]});
        }
    };

    var renderCompletion = function(elt, data, completion) {
        var type = completion.ret;
        var elem = $('<span>');
        if (type) {
            elem.append($('<span class="muted">').append(document.createTextNode(type + ' ')));
        }
        elem.append(document.createTextNode(completion.name));
        if (completion.params) {
            elem.append($('<span class="muted">').append('(' + completion.params.join(', ') + ')'));
        }
        elt.appendChild(elem[0]);
    };

    function renderHeaderCompletion(elt, data, completion) {
        $(elt).append([
            $('<span class="muted">').text('#include ' + completion.quotes[0]),
            $('<span>').text(completion.name),
            $('<span class="muted">').text(completion.quotes[1])
        ])
    }

    var mCurrentSummaryElement = null;
    var mWaiting = null;
    var renderSummary = function(completion, element) {
        if (!mCurrentSummaryElement) return;
        var docs = CloudPebble.Documentation.Lookup(completion.name || completion.text);
        if (docs && docs.description) {
            mCurrentSummaryElement.html(docs.description.replace(/[.;](\s)[\s\S]*/, '.')).show();
        } else {
            mCurrentSummaryElement.empty().hide();
        }
    };
    var showSummary = function(hints) {
        if (mCurrentSummaryElement) {
            mCurrentSummaryElement.remove();
        }
        var summary = $('<div>');
        summary.css({
            top: $(hints).offset().top + $(hints).outerHeight() - 5,
            left: $(hints).offset().left,
            width: $(hints).innerWidth() - 4,
            display: 'none'
        }).addClass('autocomplete-summary');
        summary.appendTo('body');
        mCurrentSummaryElement = summary;
        clearTimeout(mWaiting);
    };
    var hideSummary = function() {
        if (!mCurrentSummaryElement) {
            return;
        }
        mCurrentSummaryElement.remove();
        $('.CodeMirror-hints').find("li:last").remove();
        mCurrentSummaryElement = null;
    };

    function didPick(data, completion) {
        mLastAutocompletePos = data.from;
        mLastAutocompleteToken = completion.text;
    }

    var mRunning = false;
    var mLastInvocation = null;
    var mLastAutocompleteToken = null;
    var mLastAutocompletePos = null;
    var run_last = _.debounce(function() {
        if (mLastInvocation) {
            console.log("running trailing completion.");
            self.complete.apply(self, mLastInvocation);
        }
    }, 50);

    function collect_header_files() {
        var local = _.map(_.keys(CloudPebble.Editor.GetAllFiles()).sort(), function(name) {
            return {
                name: name,
                local: true
            }
        });
        var lib = _.map(CloudPebble.Dependencies.GetHeaderFileNames().sort(), function(name) {
            return {
                name: name,
                local: false
            }
        });
        return _.filter(local.concat(lib), function(item) {
            return item.name.indexOf('.h', item.length - 2) !== -1;
        }).concat({name: 'pebble.h', local: false});
    }

    /** Return a list of possible includes that a user could be trying to type. */
    function try_complete_header_files(editor) {
        var query = editor.getTokenAt(editor.getCursor()).string;
        var completions = {};
        var match;
        if (match = query.match(/^\s*#include\s+(["<])?([^>"]*)$/i)) {
            var files = collect_header_files();
            if (match[2].trim()) {
                var fuse = new Fuse(files, {
                    keys: ["name"]
                });
                files = fuse.search(match[2]);
            }

            var header_completions = _.map(files, function(file) {
                var quotes = file.local ? '""' : '<>';
                var include_text = interpolate('#include %s%s%s', [quotes[0], file.name, quotes[1]]);
                return {
                    kind: 'INCLUDE',
                    insertion_text: include_text,
                    name: file.name,
                    quotes: quotes
                }
            });
            completions = {
                completions: header_completions,
                start_column: 0
            };
        }
        return completions;
    }

    /** Try to complete a macro, by searching header files if possible or otherwise using YCM. */
    function try_complete_macro(command, editor) {
        var includes = try_complete_header_files(editor);
        if (!includes.completions)
            return CloudPebble.YCM.request(command, editor);
        else {
            return Promise.resolve(includes);
        }
    }

    this.complete = function(editor, finishCompletion, options) {
        if (mRunning) {
            mLastInvocation = [editor, finishCompletion, options];
            return;
        }
        mLastInvocation = null;
        var cursor = editor.getCursor();
        try {
            var token = editor.getTokenAt(cursor);
            if (token.string == mLastAutocompleteToken
                && token.start == mLastAutocompletePos.ch
                && cursor.line == mLastAutocompletePos.line) {
                return;
            }
            if (!token || (token.string.replace(/[^a-z0-9_]/gi, '').length < 1 && token.string != '.' && token.string != '->')) {
                return;
            }
        } catch (e) {
            return;
        }
        mRunning = true;
        var request_function;
        if (token.type === 'meta') {
            request_function = try_complete_macro
        }
        else {
            request_function = CloudPebble.YCM.request;
        }

        request_function('completions', editor).then(function(data) {
            var completions = _.map(data.completions, function(item) {
                if (item.kind == 'FUNCTION' || (item.kind == 'MACRO' && item.detailed_info.indexOf('(') > 0)) {
                    var params = item.detailed_info.substr(item.detailed_info.indexOf('(') + 1);
                    if (params[0] == ')') {
                        params = [];
                    } else {
                        params = params.substring(1, params.length - 2).split(', ');
                    }
                    return {
                        text: item.insertion_text + '(' + params.join(', ') + ')',
                        params: params,
                        ret: item.extra_menu_info,
                        name: item.insertion_text,
                        hint: expandCompletion,
                        render: renderCompletion
                    }
                } else if (item.kind == 'INCLUDE') {
                    return {
                        text: item.insertion_text,
                        name: item.name,
                        quotes: item.quotes,
                        render: renderHeaderCompletion
                    }
                } else {
                    return {text: item.insertion_text};
                }
            });
            var result = {
                list: completions,
                from: Pos(cursor.line, data.start_column - 1),
                to: Pos(cursor.line, cursor.ch)
            };
            CodeMirror.on(result, 'shown', showSummary);
            CodeMirror.on(result, 'select', renderSummary);
            CodeMirror.on(result, 'close', hideSummary);
            CodeMirror.on(result, 'pick', _.partial(didPick, result));
            finishCompletion(result);
        }).catch(function(e) {
            // Discard "ycm is generally broken" errors
            if (!e.noYCM) throw e;
        }).finally(function() {
            mRunning = false;
            run_last();
        });
    };
    this.complete.async = true;

    this.SelectPlaceholder = function(cm, pos) {
        selectPlaceholder(cm, pos);
    };
})();
