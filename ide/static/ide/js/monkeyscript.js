/**
 * Created by katharine on 7/23/15.
 */

CloudPebble.MonkeyScript = (function() {
    var DO_COMMANDS = ['single_click', 'long_click', 'wait', 'screenshot', 'reset', 'set_time',
        'install_app', 'remove_app', 'launch_app', 'airplane_mode', 'command',
        'factory_reset', 'charging', 'power_testing_enable',
        'power_testing_disable', 'multi_click'];

    var EXPECT_COMMANDS = ['equal', 'not_equal', 'power-between', 'screenshot_app', 'screenshot',
        'reset_output', 'captured_output', 'window'];

    var KEYWORDS = ['do', 'expect'];

    var make_mode = function(is_highlighter) {
        // Return a CSS class or a list of suggestions, depending on the parser's mode.
        var result = (is_highlighter ? function(kind) {
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
                            var thing = stream.match(/^[a-z_]+/i);
                            if (!thing) {
                                stream.skipToEnd();
                                return result('error');
                            }
                            thing = thing[0];
                            var list = [];
                            if (state.keyword == 'do') {
                                list = DO_COMMANDS;
                            } else if (state.keyword == 'expect') {
                                list = EXPECT_COMMANDS;
                            }
                            if (_.contains(list, thing)) {
                                if (stream.eol()) {
                                    state.command = null;
                                    state.keyword = null;
                                } else {
                                    state.command = thing;
                                }
                                return result('variable');
                            } else {
                                stream.skipToEnd();
                                state.command = null;
                                state.keyword = null;
                                return result('error', list);
                            }
                        } else {
                            stream.skipToEnd();
                            state.keyword = null;
                            state.command = null;
                            return null;
                        }
                    }

                },

                lineComment: '//'
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
                CodeMirror.runMode(line, "MonkeyScript_autocomplete", function (text, token_suggestions) {
                    pieces.push(text);
                    all_suggestions = _.clone(token_suggestions) || [];
                });

                // Fuse sorts the suggestions based on the closest match to the currently typed token and returns an array of indices.
                // A low 'distance' and 'threshold' keep the number of matches small.
                var keys = (new Fuse(all_suggestions, {
                    distance: 0,
                    threshold: 0.1
                })).search(pieces[pieces.length - 1] || "");

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
                return $.Deferred().resolve({
                    completions: final_suggestions,
                    start_column: start_column
                });
            }
        }
    }
})();
