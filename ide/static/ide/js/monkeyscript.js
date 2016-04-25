/**
 * Created by katharine on 7/23/15.
 */

CloudPebble.MonkeyScript = (function () {
    var DO_COMMANDS = ['airplane_mode', 'charging', 'launch_app', 'long_click', 'multi_click',
        'reset', 'screenshot', 'set_time', 'single_click', 'wait'];

    var EXPECT_COMMANDS = ['captured_output', 'equal', 'not_equal', 'reset_output', 'screenshot'];

    var KEYWORDS = ['do', 'expect'];


    function nextState(state, kind, nextkind) {
        if (!_.isString(kind)) throw new Error("Invalid argument");
        state.kind = kind;
        state.nextkind = (_.isUndefined(nextkind) ? null : nextkind);
    }

    function pushSpace(state, nextkind) {
        nextState(state, 'space', nextkind);
    }
    function pushSpaceOrComment(state, nextKind) {
        nextState(state, 'space_or_comment', nextKind)
    }

    function resetState(state) {
        state.kind = 'keyword';
        state.nextkind = null;
        state.keyword = null;
        state.command = null;
    }

    var make_mode = function (is_highlighter) {
        // Return a CSS class or a list of suggestions, depending on the parser's mode.
        var result = (is_highlighter ? function (kind, suggestions) {
            return kind;
        } : function (kind, suggestions) {
            return suggestions;
        });

        return function () {
            return {
                startState: function () {
                    var state = {};
                    resetState(state);
                    return state;
                },
                token: function (stream, state) {
                    if (stream.sol()) {
                        resetState(state);
                    }

                    if (state.kind == 'keyword') {
                        // Allow infinite whitespace at the start of lines
                        if (stream.eatSpace()) {
                            return;
                        }

                        // Allow fully commented lines
                        if (stream.match('#')) {
                            stream.skipToEnd();
                            return result('comment');
                        }

                        // Keywords only contain letters
                        var keyword = stream.match(/^[a-z]+/i);
                        if (!keyword) {
                            stream.skipToEnd();
                            return result('error');
                        }

                        if (_.contains(KEYWORDS, keyword[0])) {
                            // Commands come exactly one space after a valid keyword
                            state.keyword = keyword[0];
                            pushSpace(state, 'command');
                            return result('keyword');
                        }
                        else if (stream.peek() == ' ') {
                            // Invalid keywords are errors if they are followed by spaces
                            stream.skipToEnd();
                            return result('error');
                        }
                        else {
                            // If they are not followed by spaces, they are just unfinished
                            stream.skipToEnd();
                            return result('keyword', KEYWORDS);
                        }
                    }
                    if (state.kind == 'space_or_comment') {
                        // The user may finish with a comment (and perhaps no arguments)
                        if (stream.match(/\s*(#.*)?$/)) {
                            resetState(state);
                            return result('comment');
                        }
                        else {
                            pushSpace(state, state.nextkind)
                        }
                    }
                    if (state.kind == 'space') {
                        // Match a single space
                        if (!stream.match(/ /)) {
                            stream.skipToEnd();
                            return result('error');
                        }
                        // Then, match no more spaces
                        nextState(state, 'nospace', state.nextkind);
                        return null;
                    }
                    if (state.kind == 'nospace') {
                        // Any spaces matched after 'space' state are errors
                        if (stream.match(/ +/)) {
                            stream.skipToEnd();
                            return result('error');
                        }
                        nextState(state, state.nextkind);
                        return null;
                    }
                    if (state.kind == 'command') {
                        // Commands are text with underscores
                        var command = stream.match(/^[a-z_]+/i);
                        var suggestions = [];
                        if (!command) {
                            stream.skipToEnd();
                            return result('error');
                        }
                        // The available commands depend on whether the keyword was 'do' or 'expect'
                        command = command[0];
                        if (state.keyword == 'do') {
                            suggestions = DO_COMMANDS;
                        } else if (state.keyword == 'expect') {
                            suggestions = EXPECT_COMMANDS;
                        }

                        if (_.contains(suggestions, command)) {
                            // Move into arguments if the command is valid
                            if (stream.eol()) {
                                resetState(state);
                            } else {
                                state.command = command;
                                pushSpaceOrComment(state, 'argument');
                            }
                            return result('variable');
                        }
                        else if (stream.peek() == ' ') {
                            // Invalid commands are errors if followed by spaces
                            stream.skipToEnd();
                            resetState(state);
                            return result('error', suggestions);
                        }
                        else {
                            // If they are not followed by spaces, they are just unfinished
                            stream.skipToEnd();
                            return result('variable', suggestions);
                        }
                    }
                    if (state.kind == 'argument') {
                        // Or there may be no arguments at all
                        if (stream.eol()) {
                            resetState(state);
                            return null;
                        }

                        // Arguments might start with quotes. These are quoted arguments.
                        var arg, another, content;
                        var quote = stream.match(/['"]/);
                        if (quote) {
                            quote = quote[0];
                            // Match a right quote after some arbitrary text.
                            arg = stream.match(new RegExp("((\\\\"+ quote + "|[^" + quote + "])*)(" + quote + ")?"));
                            another = (!!arg && arg[3]);
                            content = (!!arg ? arg[1] : null);
                        }
                        else {
                            // If the argument is not quoted it may not contain quotes or spaces
                            arg = stream.match(/[^'"\s]+/);
                            another = (!!arg);
                            content = (!!arg ? arg[0] : null);
                        }
                        if (!quote && !content) {
                            // If no quotes or content was matched, the input was invalid.
                            nextState(state, 'end');
                            return result('error');
                        }
                        if (state.command == 'screenshot') {
                            // Screenshot commands are a special case. There is only one argument
                            // and it must look like a file name.
                            another = false;
                            var is_valid = (!!content.match(/^([.a-zA-Z0-9_-]+)$/i));
                            nextState(state, 'end');
                            return result(is_valid ? null : 'error', {command: 'screenshot'});
                        }
                        if (another) {
                            // If there's no reason not to have more arguments, do so
                            pushSpaceOrComment(state, 'argument');
                        }
                        else {
                            stream.skipToEnd();
                            resetState(state);
                        }
                        return (!!quote ? result('string') : null);
                    }
                    if (state.kind == 'end') {
                        // 'End' comes after certain things e.g. screenshot names
                        // It may be a comment, or whitespace.
                        resetState(state);
                        stream.eatSpace();
                        if (stream.match('#')) {
                            stream.skipToEnd();
                            return result('comment');
                        }
                        if (!stream.eol()) {
                            stream.skipToEnd();
                            return result('error');
                        }
                        return null;
                    }
                },
                lineComment: '#'
            }
        };
    };

    $(function () {
        CodeMirror.defineMode('MonkeyScript', make_mode(true));
        CodeMirror.defineMode('MonkeyScript_autocomplete', make_mode(false));
    });

    return {
        request: function (endpoint, editor, cursor) {
            // Get autocompletion suggestions for MonkeyScript.
            if (endpoint == 'completions') {
                cursor = cursor || editor.getCursor();
                // all_suggestions will contain the suggestions for the token at the cursor
                var all_suggestions = [];
                // pieces is an array of the parsed tokens
                var pieces = [];
                // Only parse the line up to the cursor. Since MonkeyScript is stateless, we only have to parse one line.
                var line = editor.getRange({line: cursor.line, ch: 0}, cursor);

                // With the CodeMirror.runMode addon, run the monkeyscript parser to generate suggestions
                // The last set of values from the parser gives us the current suggestions and search string.
                CodeMirror.runMode(line, "MonkeyScript_autocomplete", function (text, token_suggestions) {
                    pieces.push(text);
                    all_suggestions = _.clone(token_suggestions) || [];
                });
                var search_string = pieces[pieces.length - 1];

                // If the suggestions value is an object, an external lookup is needed for autocomplete suggestions
                if (!_.isArray(all_suggestions)) {
                    if (all_suggestions.command == 'screenshot') {
                        // Autocompletion for screenshots gets them from the editor's screenshot pane
                        all_suggestions = _.map(editor.screenshot_pane.getScreenshots(), function (screenshot) {
                            return screenshot.name + ".png";
                        });
                    }
                    else {
                        all_suggestions = [];
                    }
                }

                var keys;
                // Don't bother searching if the typed command is longer than the longest possible command.
                var max_suggestion_length = _.max(all_suggestions, function (x) {
                    return x.length
                }).length;
                if (search_string.length > max_suggestion_length) {
                    keys = [];
                }
                else {
                    // Fuse sorts the suggestions based on the closest match to the currently typed token and returns an array of indices.
                    // If these are too high, most of the keywords get matched and reordered with each new letter, which is irritating,
                    // so low values are used to keep the number of matches low, while still tolerating typing errors.
                    keys = (new Fuse(all_suggestions, {
                        distance: 3,
                        threshold: 0.3
                    })).search(search_string || "");
                }
                // Build the sorted_suggestions array using the indices
                var sorted_suggestions = [];
                _.each(keys, function (key) {
                    sorted_suggestions.push(all_suggestions[key]);
                    all_suggestions[key] = null;
                });
                // Then append all unmatched suggestions, so the user can see all options
                _.each(all_suggestions, function (suggestion) {
                    if (suggestion) sorted_suggestions.push(suggestion);
                });

                // Compute the start column by summing the length of all words on the line up to the cursor, except the final one.
                var start_column = pieces.slice(0, pieces.length - 1).join("").length + 1;

                // Finally, return the suggestions in the format expected by autocomplete.js
                var final_suggestions = _.map(sorted_suggestions, function (suggestion) {
                    return {insertion_text: suggestion}
                });

                return Promise.resolve({
                    completions: final_suggestions,
                    start_column: start_column
                });
            }
        }
    }
})();
