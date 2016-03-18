/**
 * Created by katharine on 7/23/15.
 */

CloudPebble.MonkeyScript = (function() {
    var DO_COMMANDS = ['airplane_mode', 'charging', 'launch_app', 'long_click', 'multi_click',
        'reset', 'screenshot', 'set_time', 'single_click', 'wait'];

    var EXPECT_COMMANDS = ['captured_output', 'equal', 'not_equal', 'reset_output', 'screenshot'];

    var KEYWORDS = ['do', 'expect'];

    var make_mode = function(is_highlighter) {
        // Return a CSS class or a list of suggestions, depending on the parser's mode.
        var result = (is_highlighter ? function(kind, suggestions) {
            return kind;
        } : function(kind, suggestions) {
            return suggestions;
        });

        return function() {
            return {
                startState: function() {
                    return {keyword: null, command: null};
                },
                token: function(stream, state) {
                    if (stream.peek() == '#') {
                        stream.skipToEnd();
                        return result('comment');
                    }
                    if(stream.eatSpace()) {
                        return;
                    }

                    if (stream.sol()) {
                        state.keyword = null;
                    }
                    if (state.keyword === null) {
                        var keyword = stream.match(/^[a-z_]+/i);
                        if (!keyword) {
                            stream.skipToEnd();
                            return result('error');
                        }
                        keyword = keyword[0];
                        if (keyword == 'do' || keyword == 'expect') {
                            state.keyword = keyword;
                            return result('keyword');
                        } else {
                            return result('error', KEYWORDS);
                        }
                    } else {
                        if (state.command === null) {
                            var command = stream.match(/^[a-z_]+/i);
                            if (!command) {
                                stream.skipToEnd();
                                return result('error');
                            }
                            command = command[0];
                            var list = [];
                            if (state.keyword == 'do') {
                                list = DO_COMMANDS;
                            } else if (state.keyword == 'expect') {
                                list = EXPECT_COMMANDS;
                            }
                            if (_.contains(list, command)) {
                                if (stream.eol()) {
                                    state.command = null;
                                    state.keyword = null;
                                    state.value = null;
                                } else {
                                    state.command = command;
                                }
                                return result('variable');
                            } else {
                                stream.skipToEnd();
                                state.command = null;
                                state.keyword = null;
                                state.value = null;
                                return result('error', list);
                            }
                        } else {
                            var parse_result = null;
                            if (state.command == 'screenshot') {
                                var is_valid_screenshot = stream.match(/^\s*[.a-zA-Z0-9_-]+$/i);
                                parse_result = result(is_valid_screenshot ? null : 'error', {command: 'screenshot'});
                            }
                            state.command = null;
                            state.keyword = null;
                            state.value = null;
                            stream.skipToEnd();
                            return parse_result;
                        }
                    }

                },
                lineComment: '#'
            }
        };
    };

    $(function() {
        CodeMirror.defineMode('MonkeyScript', make_mode(true));
        CodeMirror.defineMode('MonkeyScript_autocomplete', make_mode(false));
    });

    return {
        request: function(endpoint, editor, cursor) {
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
                        all_suggestions = _.map(editor.screenshot_pane.getScreenshots(), function(screenshot) {
                            return screenshot.name+".png";
                        });
                    }
                    else {
                        all_suggestions = [];
                    }
                }

                var keys;
                // Don't bother searching if the typed command is longer than the longest possible command.
                var max_suggestion_length = _.max(all_suggestions, function(x) { return x.length }).length;
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
