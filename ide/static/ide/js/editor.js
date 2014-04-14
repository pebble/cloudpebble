CloudPebble.Editor = (function() {
    var THAT_ONE_JS_FILE = 'js/pebble-js-app.js'; // You'll probably want to grep this when adding multiple JS file support.:
    var project_source_files = {};
    var open_codemirrors = {};
    var unsaved_files = 0;
    var is_fullscreen = false;

    var add_source_file = function(file) {
        CloudPebble.Sidebar.AddSourceFile(file, function() {
            edit_source_file(file);
        });

        project_source_files[file.name] = file;
        // If we're adding that one JS file, remove the link to add it.
        // (this arguably intrudes upon the sidebar's domain, but...)
        if(file.name == THAT_ONE_JS_FILE) {
            $('#new-js-file').hide();
        }
    };

    var edit_source_file = function(file) {
        // See if we already had it open.
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('source-'+file.id)) {
            return;
        }
        CloudPebble.ProgressBar.Show();

        // Open it.
        $.getJSON('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/load', function(data) {
            CloudPebble.ProgressBar.Hide();
            if(!data.success) {
                var error = $('<div class="alert alert-error"></div>');
                error.text("Something went wrong: " + data.error);
                CloudPebble.Sidebar.SetActivePane(error, '');
            } else {
                var is_js = file.name.substr(-3) == '.js';
                var source = data.source;
                var lastModified = data.modified;
                var pane = $('<div>');
                var is_autocompleting = false;
                var settings = {
                    indentUnit: USER_SETTINGS.tab_width,
                    tabSize: USER_SETTINGS.tab_width,
                    lineNumbers: true,
                    autofocus: true,
                    electricChars: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    //highlightSelectionMatches: true,
                    smartIndent: true,
                    indentWithTabs: !USER_SETTINGS.use_spaces,
                    mode: (is_js ? 'javascript' : CloudPebble.Editor.PebbleMode),
                    styleActiveLine: true,
                    value: source,
                    theme: USER_SETTINGS.theme
                };
                if(USER_SETTINGS.keybinds !== '') {
                    settings.keyMap = USER_SETTINGS.keybinds;
                }
                if(!settings.extraKeys) settings.extraKeys = {};
                if(!is_js && USER_SETTINGS.autocomplete === 2) {
                    settings.extraKeys = {'Ctrl-Space': 'autocomplete'};
                }
                if(!is_js && USER_SETTINGS.autocomplete !== 0) {
                    settings.extraKeys['Tab'] = function() {
                        var marks = code_mirror.getAllMarks();
                        var cursor = code_mirror.getCursor();
                        var closest = null;
                        var closest_mark = null;
                        var distance = 99999999999; // eh
                        for (var i = marks.length - 1; i >= 0; i--) {
                            var mark = marks[i];
                            var pos = mark.find();
                            if(pos === undefined) continue;
                            if(cursor.line >= pos.from.line - 5) {
                                if(cursor.line < pos.from.line || cursor.ch <= pos.from.ch) {
                                    var new_distance = 100000 * (pos.from.line - cursor.line) + (pos.from.ch - cursor.ch);
                                    if(new_distance < distance) {
                                        closest = pos;
                                        closest_mark = mark;
                                        distance = new_distance;
                                    }
                                }
                            }
                        }
                        if(closest !== null) {
                            closest_mark.clear();
                            CloudPebble.Editor.Autocomplete.SelectPlaceholder(code_mirror, closest);
                        } else {
                            return CodeMirror.Pass;
                        }
                    };
                }
                if(USER_SETTINGS.use_spaces) {
                    var spaces = Array(settings.indentUnit + 1).join(' ');
                    var oldTab = settings.extraKeys['Tab'];
                    settings.extraKeys['Tab'] = function(cm) {
                        // If we already overrode tab, check that one.
                        if(oldTab) {
                            if(oldTab(cm) !== CodeMirror.Pass) {
                                return;
                            }
                        }
                        if(cm.somethingSelected()) {
                            // If something is selected we want to indent the entire selection
                            var start = cm.getCursor("head").line;
                            var end = cm.getCursor("anchor").line;
                            // Which way around we get these actually depends on the way the user
                            // dragged the cursor; we always want start before end.
                            if(start > end) {
                                var temp = start;
                                start = end;
                                end = temp;
                            }
                            for(var line = start; line <= end; ++line) {
                                cm.replaceRange(spaces, {line: line, ch: 0});
                            }
                        } else {
                            // If it isn't we just indent our cursor.
                            cm.replaceSelection(spaces, "end", "+input");
                        }
                    };
                    settings.extraKeys['Backspace'] = function(cm) {
                        // Nothing interesting to do if something's selected.
                        if(cm.somethingSelected()) return CodeMirror.Pass;
                        var pos = cm.getCursor();
                        var content = cm.getRange({line: pos.line, ch:0}, pos);
                        // We only need to do special handling if the line is blank to this point.
                        if(content.replace(/\s*/, '') === '') {
                            // Allow for stray tabs that managed to get in by counting them as an appropriate number
                            // of spaces.
                            var ch = content.replace('\t', spaces).length;
                            if(ch !== 0 && ch % cm.getOption('indentUnit') === 0) {
                                var start = {line: pos.line, ch: pos.ch};
                                if(content.charAt(content.length - 1) == '\t') {
                                    start.ch -= 1;
                                } else {
                                    start.ch -= cm.getOption('indentUnit');
                                }
                                cm.replaceRange('', start, pos);
                                return;
                            }
                        }
                        return CodeMirror.Pass;
                    };
                }
                if(is_js) {
                    settings.gutters = ['CodeMirror-linenumbers', 'gutter-hint-warnings'];
                }
                var code_mirror = CodeMirror(pane[0], settings);
                code_mirror.parent_pane = pane;
                open_codemirrors[file.id] = code_mirror;
                code_mirror.cloudpebble_save = function(callback) {
                    save(callback);
                };
                code_mirror.on('close', function() {
                    is_autocompleting = false;
                });
                code_mirror.on('shown', function() {
                    is_autocompleting = true;
                });

                $(code_mirror.getWrapperElement()).mouseup(function(event) {
                    if(!event.altKey) return;
                    var x = event.pageX;
                    var y = event.pageY;
                    var char = code_mirror.coordsChar({left: x, top:y});
                    var token = code_mirror.getTokenAt(char).string;

                    create_popover(code_mirror, token, x, y);
                });

                var help_shortcut = /Mac/.test(navigator.platform) ? 'Shift-Cmd-Ctrl-/' : 'Shift-Ctrl-Alt-/';

                settings.extraKeys[help_shortcut] = function(cm) {
                    var pos = cm.cursorCoords();
                    var token = code_mirror.getTokenAt(cm.getCursor());

                    create_popover(cm, token.string, pos.left, pos.top);
                }

                if(!is_js && USER_SETTINGS.autocomplete === 1) {
                    code_mirror.on('change', function() {
                        if(!is_autocompleting)
                            CodeMirror.commands.autocomplete(code_mirror);
                    });
                }
                if(is_js) {
                    var warning_lines = [];
                    var throttled_hint = _.throttle(function() {
                        // Clear things out, even if jslint is off
                        // (the user might have just turned it off).
                        code_mirror.clearGutter('gutter-hint-warnings');
                        _.each(warning_lines, function(line) {
                            code_mirror.removeLineClass(line, 'background', 'line-hint-warning');
                        });
                        warning_lines = [];

                        // And now bail.
                        if(!CloudPebble.ProjectInfo.app_jshint) return;

                        var jshint_globals = {
                            Pebble: true,
                            console: true,
                            XMLHttpRequest: true,
                            navigator: true, // For navigator.geolocation
                            localStorage: true,
                            setTimeout: true
                        };
                        if(CloudPebble.ProjectInfo.type == 'simplyjs') {
                            _.extend(jshint_globals, {
                                simply: true,
                                util2: true,
                                ajax: true
                            });
                        }

                        var success = JSHINT(code_mirror.getValue(), {
                            freeze: true,
                            evil: false,
                            immed: true,
                            latedef: "nofunc",
                            undef: true,
                            unused: "vars"
                        }, jshint_globals);
                        if(!success) {
                            _.each(JSHINT.errors, function(error) {
                                // It is apparently possible to get null errors; omit them.
                                if(!error) return;
                                // If there are multiple errors on one line, we'll have already placed a marker here.
                                // Instead of replacing it with a new one, just update it.
                                var markers = code_mirror.lineInfo(error.line - 1).gutterMarkers;
                                if(markers && markers['gutter-hint-warnings']) {
                                    var marker = $(markers['gutter-hint-warnings']);
                                    marker.attr('title', marker.attr('title') + "\n" + error.reason);
                                } else {
                                    var warning = $('<div class="line-hint-warning"><i class="icon-warning-sign icon-white"></span></div>');
                                    warning.attr('title', error.reason);
                                    code_mirror.setGutterMarker(error.line - 1, 'gutter-hint-warnings', warning[0]);
                                    warning_lines.push(code_mirror.addLineClass(error.line - 1, 'background', 'line-hint-warning'));
                                }
                            });
                        }
                    }, 1000);
                    code_mirror.on('change', throttled_hint);
                    // Make sure we're ready when we start.
                    throttled_hint();
                }

                var check_safe = function() {
                    $.getJSON('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/is_safe?modified=' + lastModified, function(data) {
                        if(data.success && !data.safe) {
                            if(was_clean) {
                                code_mirror.setOption('readOnly', true);
                                $.getJSON('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/load', function(data) {
                                    if(data.success) {
                                        code_mirror.setValue(data.source);
                                        lastModified = data.modified;
                                        was_clean = true; // this will get reset to false by setValue.
                                    }
                                    code_mirror.setOption('readOnly', false);
                                });
                            } else {
                                alert("This file has been edited elsewhere; you will not be able to save your changes.");
                            }
                        }
                    });
                };

                var fix_height = function() {
                    if(!is_fullscreen) {
                        var browserHeight = document.documentElement.clientHeight;
                        code_mirror.getWrapperElement().style.height = browserHeight - 130 + 'px';
                        code_mirror.refresh();
                    }
                };
                fix_height();
                $(window).resize(fix_height);

                CloudPebble.Sidebar.SetActivePane(pane, 'source-' + file.id, function() {
                    code_mirror.refresh();
                    code_mirror.focus();
                    check_safe();
                }, function() {
                    if(!was_clean) {
                        --unsaved_files;
                    }
                    delete open_codemirrors[file.id];
                });

                var was_clean = true;
                code_mirror.on('change', function() {
                    if(was_clean) {
                        CloudPebble.Sidebar.SetIcon('source-' + file.id, 'edit');
                        was_clean = false;
                        ++unsaved_files;
                    }
                });

                var mark_clean = function() {
                    was_clean = true;
                    --unsaved_files;
                    CloudPebble.Sidebar.ClearIcon('source-' + file.id);
                };

                var save = function(callback) {
                    save_btn.attr('disabled','disabled');
                    delete_btn.attr('disabled','disabled');
                    $.post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/save", {
                        content: code_mirror.getValue(),
                        modified: lastModified
                    }, function(data) {
                        save_btn.removeAttr('disabled');
                        delete_btn.removeAttr('disabled');
                        if(data.success) {
                            lastModified = data.modified;
                            mark_clean();
                            ga('send', 'event' ,'file', 'save');
                        } else {
                            alert(data.error);
                        }
                        if(callback) {
                            callback()
                        }
                    });
                };

                // Add some buttons
                var button_holder = $('<p style="padding-top: 5px; text-align: right;" id="buttons_wrapper">');
                var save_btn = $('<button class="btn btn-primary">Save</button>');
                var discard_btn = $('<button class="btn" style="margin-right: 20px;">Reload file</button>');
                var delete_btn = $('<button class="btn btn-danger" style="margin-right: 20px;">Delete</button>');
                var error_area = $('<div>');

                save_btn.click(save);
                delete_btn.click(function() {
                    CloudPebble.Prompts.Confirm("Do you want to delete " + file.name + "?", "This cannot be undone.", function() {
                        save_btn.attr('disabled','disabled');
                        delete_btn.attr('disabled','disabled');
                        $.post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/delete", function(data) {
                            save_btn.removeAttr('disabled');
                            delete_btn.removeAttr('disabled');
                            if(data.success) {
                                CloudPebble.Sidebar.DestroyActive();
                                delete project_source_files[file.name];
                                CloudPebble.Sidebar.Remove('source-' + file.id);
                                // Restore the add JS button if we just removed it.
                                if(file.name == THAT_ONE_JS_FILE) {
                                    $('#new-js-file').show();
                                }
                            } else {
                                alert(data.error);
                            }
                        });
                        ga('send', 'event', 'file', 'delete');
                    });
                });

                discard_btn.click(function() {
                    CloudPebble.Prompts.Confirm(
                        "Do you want to reload " + file.name + "?",
                        "This will discard your current changes and revert to the saved version.",
                        function() {
                            CloudPebble.Sidebar.DestroyActive();
                            mark_clean();
                            edit_source_file(file);
                        }
                    );
                });

                button_holder.append(error_area);
                if(CloudPebble.ProjectInfo.type != 'simplyjs')
                    button_holder.append(delete_btn);
                button_holder.append(discard_btn);
                button_holder.append(save_btn);
                pane.append(button_holder);
                code_mirror.refresh();

                // Add fullscreen icon and click event
                var fullscreen_icon = $('<a href="#" class="fullscreen-icon open"></a><span class="fullscreen-icon-tooltip">Toggle Fullscreen</span>');
                $(code_mirror.getWrapperElement()).append(fullscreen_icon);
                fullscreen_icon.click(function(e) {
                    fullscreen(code_mirror, !is_fullscreen);
                });
                fullscreen_icon.hover(function() {
                    $('.fullscreen-icon-tooltip').fadeIn(300);
                },function() {
                    $('.fullscreen-icon-tooltip').fadeOut(300);
                });

                $(document).keyup(function(e) {
                  if (e.keyCode == 27) { fullscreen(code_mirror, false); }   // Esc exits fullscreen mode
                });

                // Tell Google
                ga('send', 'event', 'file', 'open');
            }
        });
    };

    var save_all = function(callback) {
        var pending = 0;

        var saved = function() {
            if(--pending == 0) {
                if(callback) {
                    callback();
                }
            }
        };

        $.each(open_codemirrors, function(index, value) {
            ++pending;
            value.cloudpebble_save(saved);
        });

        if(pending === 0) {
            callback();
        }
    };

    function init() {
        CodeMirror.commands.autocomplete = function(cm) {
            CodeMirror.showHint(cm, CloudPebble.Editor.Autocomplete.Complete, {completeSingle: false});
        };
        CodeMirror.commands.save = function(cm) {
            cm.cloudpebble_save();
        };
        CodeMirror.commands.saveAll = function(cm) {
            save_all();
        };
    }

    function fullscreen(code_mirror, toggle) {
        if(toggle) {
            $(code_mirror.getWrapperElement())
                .addClass('FullScreen')
                .css({'height': '100%'})
                .appendTo($('body'));
        } else {
            var browserHeight = document.documentElement.clientHeight;
            var newHeight = (browserHeight - 130) + 'px';
            $(code_mirror.getWrapperElement())
                .removeClass('FullScreen')
                .css({'height' : newHeight})
                .prependTo(code_mirror.parent_pane);
        }
        code_mirror.refresh();
        code_mirror.focus();
        is_fullscreen = toggle;
    }

    function create_popover(cm, token, pos_x, pos_y) {
        var doc = CloudPebble.Documentation.Lookup(token);
        if(!doc) {
            return;
        }
        var popover = $('<div class="popover bottom doc-popover"><div class="arrow"></div><div class="popover-content"></div></div>');
        popover.css({
            top: pos_y,
            left: pos_x - 250
        });

        var signature = '';
        if(doc.kind == 'typedef') {
            signature += 'typedef ';
        }
        signature += doc.returns + ' ' + doc.name;
        if(doc.kind == 'fn' || (doc.kind == 'enum' && /\(/.test(doc.type))) {
            signature += '(';
            if(doc.params.length === 0) {
                signature += 'void';
            } else {
                var params = [];
                _.each(doc.params, function(param) {
                    var param_text = '';
                    param_text += param.type;
                    if(!/\*$/.test(param.type)) {
                        param_text += ' ';
                    }
                    param_text += param.name;
                    params.push(param_text);
                });
                signature += params.join(', ');
            }
            signature += ')';
        }

        var sig_element = $('<span class="popover-declaration">').text(signature);

        var result = [['Declaration', sig_element]];

        if(doc.description) {
            result.push(['Description', $('<div>').html(doc.description)]);
        }

        if(doc.return_desc) {
            result.push(['Returns', doc.return_desc]);
        }

        if(doc.params.length > 0) {
            var table = $('<table class="popover-params">');
            _.each(doc.params, function(param) {
                if(!param.description) return;
                var tr = $('<tr>');
                tr.append($('<td class="param-name">').html(param.name));
                tr.append($('<td class="param-desc">').html(param.description));
                table.append(tr);
            });
            if(table.find('tr').length)
                result.push(['Parameters', table]);
        }

        if(doc.warning) {
            result.push(['Note', $('<strong>').html(doc.warning)]);
        }

        var final_table = $('<table>');
        _.each(result, function(row) {
            var tr = $('<tr>');
            tr.append($('<th>').text(row[0]));
            tr.append($('<td>').append(row[1]));
            final_table.append(tr);
        });

        popover.find('.popover-content').append(final_table);

        popover.appendTo('body');

        if(pos_y + popover.height() + 20 > $(window).height()) {
            popover.css({top: pos_y - popover.height() - 10});
            popover.addClass('top').removeClass('bottom');
        } else {
            popover.css({top: pos_y + 10});
        }

        if(pos_x + 250 > $(window).width()) {
            var overshoot = pos_x + 250 - $(window).width() + 5;
            popover.css({left: pos_x - 250 - overshoot});
            popover.find('.arrow').css({'margin-left': overshoot - 10});
        }

        popover.show().focus();

        setTimeout(function() {
            var remove = function() {
                $('body').off('keyup', handler);
                if(!popover) return;
                popover.remove();
                popover = null;
                cm.focus();
            }
            var handler = function(e) {
                if(e.keyCode == 27) { // esc
                    remove();
                }
            };

            $('body').one('mouseup', remove);
            $('body').on('keydown', handler);
        }, 1);
    }

    return {
        Create: function() {
            CloudPebble.Prompts.Prompt("New Source File", "Enter a name for the new file", "somefile.c", '', function(value, resp) {
               if(value === '') {
                    resp.error("You must specify a filename.");
                } else if(!(/\.h$/.test(value) || /\.c$/.test(value))) {
                    resp.error("Source files must end in .c or .h");
                } else if(project_source_files[value]) {
                    resp.error("A file called '" + value + "' already exists.");
                } else {
                    resp.disable();
                    $.post("/ide/project/" + PROJECT_ID + "/create_source_file", {'name': value}, function(data) {
                        if(!data.success) {
                            resp.error(data.error);
                        } else {
                            resp.dismiss();
                            add_source_file(data.file);
                            edit_source_file(data.file);
                        }
                    });
                    ga('send', 'event', 'file', 'create');
                }
            });
        },
        DoJSFile: function() {
            $.post("/ide/project/" + PROJECT_ID + "/create_source_file", {'name': THAT_ONE_JS_FILE}, function(data) {
                if(!data.success) {
                    alert(data.error);
                } else {
                    add_source_file(data.file);
                    edit_source_file(data.file);
                }
            });
        },
        Add: function(file) {
            add_source_file(file);
        },
        Init: function() {
            init();
        },
        GetUnsavedFiles: function() {
            return unsaved_files;
        },
        Open: function(file) {
            edit_source_file(file);
        },
        SaveAll: function(callback) {
            save_all(callback);
        }
    };
})();
