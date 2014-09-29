CloudPebble.Editor.Autocomplete = new (function() {
    var Pos = CodeMirror.Pos;

    var mSelectionCallback = null;

    var preventIncludingQuotes = function(old_selection, expected_text, cm, selection) {
        selection = selection.ranges[0];
        cm.off('beforeSelectionChange', mSelectionCallback);
        var text = cm.getRange(selection.anchor, selection.head);
        var old_text = cm.getRange(old_selection.from, old_selection.to);
        if(old_text == expected_text) {
            createMark(cm, old_selection.from, old_selection.to);
        } else if((text[0] == "'" && text[text.length-1] == "'") || (text[0] == '"' && text[text.length-1] == '"')) {
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
        start = data.from.ch + completion.name.length + 1; // +1 for open paren
        var orig_start = start;
        var first_pos = null;
        var first_mark = null;
        $.each(completion.params, function(index, value) {
            var p = [{line: data.from.line, ch:start}, {line: data.from.line, ch:start + value.length}];
            var mark = createMark(cm, p[0], p[1]);
            if(first_pos === null) first_pos = p;
            if(first_mark === null) first_mark = mark;
            start += value.length + 2;
        });
        if(first_pos === null) {
            cm.setSelection({ch: orig_start, line: data.from.line});
        } else {
            first_mark.clear();
            selectPlaceholder(cm, {from: first_pos[0], to: first_pos[1]});
        }
    };

    var renderCompletion = function(elt, data, completion) {
        var type = completion.ret;
        var elem = $('<span>');
        elem.append($('<span class="muted">').append(document.createTextNode(type + ' ')));
        elem.append(document.createTextNode(completion.name));
        elem.append($('<span class="muted">').append('(' + completion.params.join(', ') + ')'));
        elt.appendChild(elem[0]);
    };

    var mCurrentSummaryElement = null;
    var mWaiting = null;
    var renderSummary = function(completion, element) {
        if(!mCurrentSummaryElement) return;
        var docs = CloudPebble.Documentation.Lookup(completion.name || completion.text);
        if(docs && docs.description) {
            mCurrentSummaryElement.html(docs.description.replace(/[.;](\s)[\s\S]*/, '.')).show();
        } else {
            mCurrentSummaryElement.empty().hide();
        }
    };
    var showSummary = function(hints) {
        if(mCurrentSummaryElement) {
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
        if(!mCurrentSummaryElement) {
            return;
        }
        mCurrentSummaryElement.remove();
        $('.CodeMirror-hints').find("li:last").remove();
        mCurrentSummaryElement = null;
    };

    function didPick(data, completion) {
        console.log("picked");
        console.log(data, completion);
        mLastAutocompletePos = data.from;
        mLastAutocompleteToken = completion.text;
    }

    var mRunning = false;
    var mLastAutocompleteToken = null;
    var mLastAutocompletePos = null;
    this.complete = function(editor, finishCompletion, options) {
        if(mRunning) return;
        var cursor = editor.getCursor();
        try {
            var token = editor.getTokenAt(cursor);
            console.log(token.string, mLastAutocompleteToken, token.start, mLastAutocompletePos);
            if(token.string == mLastAutocompleteToken
                && token.start == mLastAutocompletePos.ch
                && cursor.line == mLastAutocompletePos.line) {
                return;
            }
            console.log("token '" + token.string + "'");
            if(!token || (token.string.trim().length < 2 && token.string != '.' && token.string != '->')) {
                return;
            }
        } catch(e) {
            return;
        }
        console.log('go go gadget autocomplete');
        mRunning = true;
        var these_patches = editor.patch_list;
        editor.patch_list = [];
        $.ajax(mAutocompleteServer + 'ycm/' + mAutocompleteUUID + '/completions', {
            data: JSON.stringify({
                file: editor.file_path,
                line: cursor.line,
                ch: cursor.ch,
                patches: _.map(these_patches, function(patch) {
                    return {
                        start: patch.from,
                        end: patch.to,
                        filename: editor.file_path,
                        text: patch.text
                    }
                })
            }),
            contentType: 'application/json',
            method: 'POST'
        }).done(function(data) {
            console.log(data);
            var completions = _.map(data.completions.completions, function(item) {
                if(item.kind == 'FUNCTION' || (item.kind == 'MACRO' && item.detailed_info.indexOf('(') > 0)) {
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
                } else {
                    return {text: item.insertion_text};
                }
            });
            var result = {
                list: completions,
                from: Pos(cursor.line, data.completions.completion_start_column - 1),
                to: Pos(cursor.line, cursor.ch)
            };
            finishCompletion(result);
            CodeMirror.on(result, 'shown', showSummary);
            CodeMirror.on(result, 'select', renderSummary);
            CodeMirror.on(result, 'close', hideSummary);
            CodeMirror.on(result, 'pick', _.partial(didPick, result));
        }).fail(function() {
            console.log("failed");
            editor.patch_list = these_patches.concat(editor.patch_list);
        }).always(function() {
            mRunning = false;
        });
    };
    this.complete.async = true;

    var mIsInitialised = false;
    var mAutocompleteUUID = null;
    var mAutocompleteServer = null;
    function handle_autocomplete_ready(data) {
        if(data.success) {
            mIsInitialised = true;
            mAutocompleteServer = data.server;
            mAutocompleteUUID = data.uuid;
        }
    }

    this.init = function() {
        $.post('/ide/project/' + PROJECT_ID + '/autocomplete/init')
            .done(handle_autocomplete_ready)
            .fail(function() {
                console.log("Autocomplete setup failed.");
            })
    };

    this.IsInitialised = function() {
        return mIsInitialised;
    };

    this.SelectPlaceholder = function(cm, pos) {
        selectPlaceholder(cm, pos);
    };
})();
