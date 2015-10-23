/**
 * Created by katharine on 7/23/15.
 */

$(function() {
    EditorModeMonkeyScript = function() {
        return {
            startState: function() {
                return {current_block: null, did_setup: false, did_test: false, keyword: null, command: null};
            },
            token: function(stream, state) {
                if (stream.peek() == '#') {
                    stream.skipToEnd();
                    return 'comment';
                }
                if(stream.eatSpace()) {
                    return;
                }
                if (state.current_block === null) {
                    var block;
                    if ((block = stream.match(/^[a-zA-Z0-9_]+/))) {
                        if (!block) {
                            stream.skipToEnd();
                            return 'error';
                        }
                        block = block[0];
                        if (block == 'setup') {
                            var result = state.did_setup ? 'error' : 'keyword';
                            state.current_block = 'setup-brace';
                            return result;
                        } else if (block == 'test') {
                            var result = state.did_test ? 'error' : 'keyword';
                            state.current_block = 'test-name';
                            return result;
                        } else {
                            stream.eatWhile(/^[^\s]/);
                            return 'error';
                        }
                    } else {
                        stream.skipToEnd();
                        return 'error';
                    }
                } else if (state.current_block == 'test-name') {
                    if (stream.match(/^[\w\s]+/)) {
                        state.current_block = 'test-brace';
                        return 'string';
                    } else {
                        stream.eatSpace();
                        if (stream.eat('{')) {
                            state.current_block = 'test';
                        }
                        return 'error';
                    }
                } else if (state.current_block == 'test-brace') {
                    if (stream.eat('{')) {
                        state.current_block = 'test';
                        state.did_test = true;
                        return 'bracket';
                    }
                } else if (state.current_block == 'setup-brace') {
                    if (stream.eat('{')) {
                        state.current_block = 'setup';
                        state.did_setup = true;
                        return 'bracket';
                    }
                } else if (state.current_block == 'setup' || state.current_block == 'test') {
                    if (stream.sol()) {
                        state.keyword = null;
                    }
                    if (stream.eat('}')) {
                        state.current_block = null;
                        return 'bracket';
                    }
                    if (state.keyword === null) {
                        var command = stream.match(/^[a-z_]+/i);
                        if (!command) {
                            stream.skipToEnd();
                            return 'error';
                        }
                        command = command[0];
                        if (command == 'do' || command == 'expect' || command == 'context') {
                            state.keyword = command;
                            return 'keyword';
                        } else {
                            return 'error';
                        }
                    } else {
                        //console.log(state.keyword, state.command);
                        if (state.command === null) {
                            var thing = stream.match(/^[a-z_]+/i);
                            if (!thing) {
                                stream.skipToEnd();
                                return 'error';
                            }
                            thing = thing[0];
                            var list = [];
                            if (state.keyword == 'do') {
                                list = ['single_click', 'long_click', 'wait', 'screenshot', 'reset', 'set_time',
                                    'install_app', 'remove_app', 'launch_app', 'airplane_mode', 'command',
                                    'factory_reset', 'charging', 'power_testing_enable',
                                    'power_testing_disable', 'multi_click'];
                            } else if (state.keyword == 'expect') {
                                list = ['equal', 'not_equal', 'power-between', 'screenshot_app', 'screenshot',
                                    'reset_output', 'captured_output', 'window'];
                            } else if (state.keyword == 'context') {
                                list = ['bigboard'];
                            }
                            if (_.contains(list, thing)) {
                                if (stream.eol()) {
                                    state.command = null;
                                    state.keyword = null;
                                } else {
                                    state.command = thing;
                                }
                                return 'variable';
                            } else {
                                stream.skipToEnd();
                                state.command = null;
                                state.keyword = null;
                                return 'error';
                            }
                        } else {
                            stream.skipToEnd();
                            state.keyword = null;
                            state.command = null;
                            return null;
                        }
                    }
                }
            },

            lineComment: '//'
        }
    };

    CodeMirror.defineMode('MonkeyScript', EditorModeMonkeyScript);
});
