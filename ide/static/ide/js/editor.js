CloudPebble.Editor = (function() {
    var project_source_files = {};
    var open_codemirrors = {};
    var unsaved_files = 0;
    var is_fullscreen = false;
    var resume_fullscreen = false;

    var add_source_file = function(file) {
        CloudPebble.Sidebar.AddSourceFile(file, function() {
            edit_source_file(file);
        });

        project_source_files[file.file_path] = file;
    };

    var file_with_name_and_target_exists = function(name, target) {
        return !!_.findWhere(CloudPebble.Editor.GetAllFiles(), {target: target, name: name});
    };

    var run = function() {
        CloudPebble.Prompts.Progress.Show(gettext("Saving..."));
        CloudPebble.Editor.SaveAll().then(function() {
            CloudPebble.Prompts.Progress.Show(gettext("Compiling..."));
            return CloudPebble.Compile.RunBuild()
        }).then(function (success) {
            CloudPebble.Prompts.Progress.Hide();
            if(success) {
                if (CloudPebble.ProjectProperties.is_runnable) {
                    return CloudPebble.Compile.DoInstall();
                }
                else {
                    CloudPebble.Prompts.Progress.Update(gettext('Package built successfully.'));
                    CloudPebble.Prompts.Progress.Success();
                }
            } else {
                CloudPebble.Compile.Show();
            }
        }).catch(function(error) {
            CloudPebble.Prompts.Progress.Update(error.toString());
            CloudPebble.Prompts.Progress.Fail();
        });
    };

    var rename_file = function(file, new_name) {
        var old_name = file.name;
        // Check no-change or duplicate filenames
        if (new_name == old_name) {
            return Promise.resolve();
        }
        var new_path = file.file_path.slice(0, file.file_path.length-file.name.length) + new_name;
        if (project_source_files[new_path]) {
            return Promise.reject(new Error(interpolate(gettext("A file of called '%s' of type '%s' already exists."), [new_name, CloudPebble.TargetNames[file.target]])));
        }
        return Ajax.Post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/rename", {
            old_name: file.name,
            new_name: new_name,
            modified: file.lastModified
        }).then(function(response) {
            var new_file_path = response.file_path;
            _.findWhere(open_codemirrors, {file_path: file.file_path}).file_path = new_file_path;
            CloudPebble.YCM.renameFile(file.file_path, new_file_path);
            delete project_source_files[file.file_path];
            file.name = new_name;
            file.file_path = new_file_path;
            file.lastModified = response.modified;
            CloudPebble.Sidebar.SetItemName('source', file.id, new_name);
            CloudPebble.FuzzyPrompt.SetCurrentItemName(new_name);
            project_source_files[file.file_path] = file;
            return null;
        });
    };

    var edit_source_file = function(file, show_ui_editor) {
        CloudPebble.FuzzyPrompt.SetCurrentItemName(file.name);
        // See if we already had it open.
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('source-'+file.id)) {
            if (resume_fullscreen) {
                fullscreen(open_codemirrors[file.id], true);
            }
            return Promise.resolve(open_codemirrors[file.id]);
        }
        CloudPebble.ProgressBar.Show();

        // Open it.
        return Ajax.Get('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/load').then(function(data) {
            var source = data.source;
            file.lastModified = data.modified;
            var pane = $('<div>');
            var file_kind, file_mode;
            if (/\.js$/.test(file.name)) {
                file_kind = 'js';
                file_mode = 'javascript';
            }
            else if (/\.json$/.test(file.name)) {
                file_kind = 'json';
                file_mode = 'application/json';
            }
            else {
                file_kind = 'c';
                file_mode = CloudPebble.Editor.PebbleMode;
            }
            function file_kind_in(options) {
                return _.contains(options, file_kind);
            }
            var language_has_autocomplete = (file_kind == 'c');
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
                mode: file_mode,
                styleActiveLine: true,
                value: source,
                theme: USER_SETTINGS.theme,
                foldGutter: true
            };
            if(USER_SETTINGS.keybinds !== '') {
                settings.keyMap = USER_SETTINGS.keybinds;
            }
            if(!settings.extraKeys) settings.extraKeys = {};
            if(language_has_autocomplete && USER_SETTINGS.autocomplete === 2) {
                settings.extraKeys = {'Ctrl-Space': 'autocomplete'};
            }
            if(language_has_autocomplete && USER_SETTINGS.autocomplete !== 0) {
                settings.extraKeys['Tab'] = function() {
                    var marks = code_mirror.getAllMarks();
                    var cursor = code_mirror.getCursor();
                    var closest = null;
                    var closest_mark = null;
                    var distance = 99999999999; // eh
                    for (var i = marks.length - 1; i >= 0; i--) {
                        var mark = marks[i];
                        if (mark.className !== "cm-autofilled") continue;
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
            settings.extraKeys['Cmd-/'] = function(cm) {
                CodeMirror.commands.toggleComment(cm);
            };
            settings.extraKeys['Ctrl-/']  = function(cm) {
                CodeMirror.commands.toggleComment(cm);
            };

            settings.gutters = ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'];
            if(file_kind_in(['js', 'json'])) {
                settings.gutters.unshift('gutter-hint-warnings');
            } else if (file_kind == 'c') {
                settings.gutters.unshift('gutter-errors');
            }
            var code_mirror = CodeMirror(pane[0], settings);
            code_mirror.file_path = file.file_path;
            code_mirror.file_target = file.target;
            code_mirror.parent_pane = pane;
            code_mirror.patch_list = [];
            code_mirror.patch_sequence = 0;
            open_codemirrors[file.id] = code_mirror;
            code_mirror.cloudpebble_save = function() {
                return save();
            };
            code_mirror.on('close', function() {
                is_autocompleting = false;
            });
            code_mirror.on('shown', function() {
                is_autocompleting = true;
            });

            // The browser should probably do this without our help. Sometimes Safari doesn't.
            $(document).click(function(e) {
                if(!is_fullscreen && !pane.find(e.target).length) {
                    $(code_mirror.display.input).blur();
                }
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
            };

            if(language_has_autocomplete && USER_SETTINGS.autocomplete === 1) {
                code_mirror.on('changes', function(instance, changes) {
                    update_patch_list(instance, changes);
                    if(!is_autocompleting)
                        CodeMirror.commands.autocomplete(code_mirror);
                });
            }

            if(file_kind_in(['json', 'js'])) {
                var warning_lines = [];
                var do_hint = function() {
                    var errors = [];
                    // Clear things out, even if jslint is off
                    // (the user might have just turned it off).
                    code_mirror.clearGutter('gutter-hint-warnings');
                    _.each(warning_lines, function(line) {
                        code_mirror.removeLineClass(line, 'background', 'line-hint-warning');
                    });
                    warning_lines = [];

                    if (file_kind == 'js') {
                        var jshint_globals = {
                            console: true,
                            setTimeout: true,
                            setInterval: true,
                            Int8Array: true,
                            Uint8Array: true,
                            Uint8ClampedArray: true,
                            Int16Array: true,
                            Uint16Array: true,
                            Int32Array: true,
                            Uint32Array: true,
                            Float32Array: true,
                            Float64Array: true
                        };

                        if (CloudPebble.ProjectInfo.type != 'rocky') {
                            _.extend(jshint_globals, {
                                Pebble: true,
                                WebSocket: true,
                                XMLHttpRequest: true,
                                navigator: true,
                                localStorage: true
                            });
                        }

                        if (CloudPebble.ProjectInfo.type == 'simplyjs') {
                            _.extend(jshint_globals, {
                                simply: true,
                                util2: true,
                                ajax: true
                            });
                        } else if (CloudPebble.ProjectInfo.type == 'pebblejs') {
                            _.extend(jshint_globals, {
                                require: true,
                                ajax: true
                            });
                        } else if (CloudPebble.ProjectInfo.app_modern_multi_js) {
                            _.extend(jshint_globals, {
                                require: true,
                                exports: true,
                                module: true
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
                        if (!success) {
                            errors = JSHINT.errors;
                        }
                    }
                    else {
                        var code = code_mirror.getValue();
                        try {
                            json_parse(code);
                        }
                        catch (e) {
                            errors = [{
                                reason: e.message,
                                line: code.slice(0, e.at).split('\n').length
                            }]
                        }
                    }

                    _.each(errors, function(error) {
                        // It is apparently possible to get null errors; omit them.
                        if(!error) return;
                        // If there are multiple errors on one line, we'll have already placed a marker here.
                        // Instead of replacing it with a new one, just update it.
                        var markers = code_mirror.lineInfo(error.line - 1).gutterMarkers;
                        if(markers && markers['gutter-hint-warnings']) {
                            var marker = $(markers['gutter-hint-warnings']);
                            marker.attr('title', marker.attr('title') + "\n" + error.reason);
                        } else {
                            var warning = $('<i class="icon-warning-sign icon-white"></span>');
                            warning.attr('title', error.reason);
                            code_mirror.setGutterMarker(error.line - 1, 'gutter-hint-warnings', warning[0]);
                            warning_lines.push(code_mirror.addLineClass(error.line - 1, 'background', 'line-hint-warning'));
                        }
                    });
                };
                code_mirror.on('change', _.debounce(do_hint, 1000));
                // Make sure we're ready when we start.

                do_hint();
            }
            if (file_kind == 'c') {
                var clang_lines = [];
                var sChecking = false;
                var debounced_check = _.debounce(function() {
                    if(sChecking) return;
                    sChecking = true;
                    CloudPebble.YCM.request('errors', code_mirror)
                        .then(function(data) {
                            _.each(clang_lines, function(line) {
                                code_mirror.removeLineClass(line, 'background', 'line-clang-warning');
                                code_mirror.removeLineClass(line, 'background', 'line-clang-error');
                            });
                            clang_lines = [];
                            code_mirror.clearGutter('gutter-errors');
                            if(data.errors) {
                                _.each(data.errors, function(error) {
                                    if(error.kind != "ERROR" && error.kind != "WARNING") {
                                        return;
                                    }
                                    error.text = error.platforms.join(', ') + ': ' + error.text;
                                    var line = error.location.line_num - 1;
                                    var line_info = code_mirror.lineInfo(line);
                                    if(!line_info) {
                                        console.log('line_info is null.', line, data);
                                        return;
                                    }
                                    var markers = line_info.gutterMarkers;
                                    if(markers && markers['gutter-errors']) {
                                        var marker = $(markers['gutter-errors']);
                                        marker.attr('title', marker.attr('title') + "\n" + error.text);
                                    } else {
                                        var cls = error.kind == 'ERROR' ? 'icon-remove-sign' : 'icon-warning-sign';
                                        var warning = $('<i class="' + cls + ' icon-white"></span>');
                                        warning.attr('title', error.text);
                                        code_mirror.setGutterMarker(line, 'gutter-errors', warning[0]);
                                        cls = error.kind == 'ERROR' ? 'line-clang-error' : 'line-clang-warning';
                                        clang_lines.push(code_mirror.addLineClass(line, 'background', cls));
                                    }
                                });
                            }
                        }).catch(function(e) {
                            // Discard "ycm is generally broken" errors
                            if (!e.noYCM) throw e;
                        }).finally(function() {
                            sChecking = false;
                        });
                }, 2000);
                code_mirror.on('change', debounced_check);
                debounced_check();

                code_mirror.on('mousedown', function(cm, e) {
                    if(e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        var pos = cm.coordsChar({left: e.pageX, top: e.pageY});
                        CloudPebble.YCM.request('goto', cm, pos)
                            .then(function(data) {
                                if(data.location) {
                                    var location = data.location;
                                    return CloudPebble.Editor.GoTo({file_path: location.filepath}, location.line, location.ch);
                                }
                            }).catch(function(err) {
                                alert(gettext("Cannot go to symbol: ")+(err.message.trim() || gettext("code completion is unavailable.")));
                            });
                    }
                });
            }

            code_mirror.force_fold_lines(data.folded_lines);
            // This is needed to force focus on the editor
            setTimeout(function() { code_mirror.focus();}, 1);

            function update_patch_list(instance, changes) {
                _.each(changes, function(change) {
                    instance.patch_list.push({
                        sequence: instance.patch_sequence++,
                        start: change.from,
                        end: change.to,
                        text: change.text,
                        filename: instance.file_path
                    });
                });
            }

            var check_safe = function() {
                return Ajax.Get('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/is_safe?modified=' + file.lastModified).then(function(data) {
                    if(!data.safe) {
                        if(was_clean) {
                            code_mirror.setOption('readOnly', true);
                            return CloudPebble.Get('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/load', function(data) {
                                code_mirror.setValue(data.source);
                                file.lastModified = data.modified;
                                was_clean = true; // this will get reset to false by setValue.
                            }).finally(function() {
                                code_mirror.setOption('readOnly', false);
                            });
                        } else {
                            alert(gettext("This file has been edited elsewhere; you will not be able to save your changes."));
                        }
                    }
                }).catch(function(error) {
                    alert(gettext(interpolate("Failed to reload file. %s", [error])));
                });
            };

            CloudPebble.Sidebar.SetActivePane(pane, {
                id: 'source-' + file.id,
                onRestore: function() {
                    code_mirror.refresh();
                    _.defer(function() { code_mirror.focus(); });
                    check_safe();
                    refresh_ib();
                },
                onSuspend: function() {
                    if (is_fullscreen) {
                        fullscreen(code_mirror, false);
                        resume_fullscreen = true;
                    }
                },
                onDestroy: function() {
                    if(!was_clean) {
                        --unsaved_files;
                    }
                    delete open_codemirrors[file.id];
                }
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

            var save = function() {
                // Make sure we're up to date with whatever changed in IB.
                if(ib_showing) {
                    var content = code_mirror.getValue();
                    var new_content = ib_editor.integrateSource(content);
                    if(content != new_content) {
                        code_mirror.setValue(new_content);
                    }
                }
                save_btn.prop('disabled', true);
                delete_btn.prop('disabled', true);

                return Ajax.Post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/save", {
                    content: code_mirror.getValue(),
                    modified: file.lastModified,
                    folded_lines: JSON.stringify(code_mirror.get_folded_lines())
                }).then(function(data) {
                    file.lastModified = data.modified;
                    mark_clean();
                    ga('send', 'event' ,'file', 'save');
                }).finally(function() {
                    save_btn.prop('disabled', false);
                    delete_btn.prop('disabled', false);
                });
            };

            var show_rename_prompt = function() {
                var old_type = file.name.split('.').pop();
                var c_pattern = "[a-zA-Z0-9_-]+\.(c|h)$";
                var js_pattern = "[a-zA-Z0-9_-]+\.js$";
                var pattern = "";
                if (old_type == "c" || old_type == "h") {
                    pattern = c_pattern;
                }
                if (old_type == "js") {
                    pattern = js_pattern;
                }
                CloudPebble.Prompts.Prompt(
                    gettext("Rename File"),
                    gettext("Filename"),
                    "",
                    function() {
                        return file.name;
                    },
                    function(value, prompt) {
                        var regexp = new RegExp(pattern);
                        if (value.match(regexp) === null) {
                            prompt.error(gettext("Invalid filename"));
                        }
                        rename_file(file, value).then(function() {
                            prompt.dismiss();
                            code_mirror.focus();
                        }).catch(function(error) {
                            prompt.error(gettext(interpolate("Failed to rename file. %s", [error.message])));
                        });
                    },
                    pattern)
            };

            var ib_pane = $('#ui-editor-pane-template').clone().removeClass('hide').appendTo(pane).hide();
            var ib_editor = new IB(ib_pane.find('.ui-canvas'), ib_pane.find('#ui-properties'), ib_pane.find('#ui-toolkit'), ib_pane.find('#ui-layer-list > div'));
            var ib_showing = false;

            CloudPebble.GlobalShortcuts.SetShortcutHandlers({
                save: function() {
                    save().catch(alert);
                }
            });

            function toggle_ib() {
                if(!ib_showing) {
                    $(code_mirror.getWrapperElement()).hide();
                    ib_pane.show();
                    ib_editor.setSource(code_mirror.getValue());
                    delete_btn.hide();
                    discard_btn.hide();
                    ib_btn.addClass('active');
                } else {
                    var content = code_mirror.getValue();
                    var new_content = ib_editor.integrateSource(content);
                    if(content != new_content) {
                        code_mirror.setValue(new_content);
                    }
                    ib_pane.hide();
                    ib_editor.clean();
                    $(code_mirror.getWrapperElement()).show();
                    code_mirror.refresh();
                    code_mirror.focus();
                    delete_btn.show();
                    discard_btn.show();
                    ib_btn.removeClass('active');
                }
                ib_showing = !ib_showing;
            }

            function refresh_ib() {
                if(!ib_showing) {
                    return;
                }
                // This is terrible.
                toggle_ib();
                toggle_ib();
            }

            ib_editor.on('changed', _.throttle(function() {
                if(!ib_showing) {
                    return;
                }
                var content = code_mirror.getValue();
                var new_content = ib_editor.integrateSource(content);
                if(content != new_content) {
                    code_mirror.setValue(new_content);
                }
                ib_editor.setSource(new_content, false);
            }), 10000);

            ib_editor.on('selection', function() {
                ib_pane.find('a[href=#ui-properties]').tab('show');
            });

            // Add some buttons
            var button_holder = $('<p class="editor-button-wrapper">');
            var run_btn = $('<button class="btn run-btn" title="' + gettext("Save, build, install and run") + '"></button>');
            var save_btn = $('<button class="btn save-btn" title="' + gettext('Save') + '"></button>');
            var discard_btn = $('<button class="btn reload-btn" title="' + gettext('Reload') + '"></button>');
            var delete_btn = $('<button class="btn delete-btn" title="' + gettext('Delete') + '"></button>');
            var ib_btn = $('<button class="btn ib-btn" title="' + gettext('UI Editor') + '"></button>');
            var rename_btn = $('<button class="btn rename-btn" title="' + gettext('Rename File') + '"></button>');
            var error_area = $('<div>');

            save_btn.click(function() {
                save().catch(alert);
            });
            delete_btn.click(function() {
                var fmt = gettext("Do you want to delete %(name)s?");
                CloudPebble.Prompts.Confirm(interpolate(fmt, file, true), gettext("This cannot be undone."), function() {
                    save_btn.attr('disabled','disabled');
                    delete_btn.attr('disabled','disabled');
                    Ajax.Post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/delete").then(function(data) {
                        CloudPebble.Sidebar.DestroyActive();
                        delete project_source_files[file.file_path];
                        CloudPebble.Sidebar.Remove('source-' + file.id);
                        return CloudPebble.YCM.deleteFile(file);
                    }).catch(alert).finally(function() {
                        save_btn.removeAttr('disabled');
                        delete_btn.removeAttr('disabled');
                    });
                    ga('send', 'event', 'file', 'delete');
                });
            });

            discard_btn.click(function() {
                CloudPebble.Prompts.Confirm(
                    interpolate(gettext("Do you want to reload %(name)s?"), file, true),
                    gettext("This will discard your current changes and revert to the saved version."),
                    function() {
                        CloudPebble.Sidebar.DestroyActive();
                        mark_clean();
                        edit_source_file(file);
                    }
                );
            });

            rename_btn.click(show_rename_prompt);

            run_btn.click(run);
            // Show the current build/run targets in a popover on the run button.
            run_btn.popover({
                trigger: 'hover',
                content: function() {
                    var capitalise_first_letter = function(str) {return str.charAt(0).toUpperCase() + str.slice(1);};

                    var tooltip = $('<div>');
                    var build_platforms = CloudPebble.ProjectInfo.app_platforms;
                    if (build_platforms) {
                        var build_platform_names = _.map(build_platforms.split(','), capitalise_first_letter).join(', ');
                        tooltip.append($(interpolate("<div><strong>%s: </strong>%s</div>", [gettext("Build for"), build_platform_names])));
                    }
                    var run_platform = CloudPebble.Compile.GetPlatformForInstall();
                    var run_platform_name;
                    if (run_platform == ConnectionType.Phone) {
                        run_platform_name = gettext("Phone");
                    }
                    else if (run_platform == ConnectionType.Qemu) {
                        // If the emulator is already running, ask it directly what platform it's using
                        run_platform_name = interpolate("%s Emulator", [SharedPebble.getPlatformName()]);
                    }
                    else {
                        run_platform_name = interpolate("%s Emulator", [ConnectionPlatformNames[run_platform]]);
                    }
                    tooltip.append(interpolate("<div><strong>%s: </strong>%s</div>", [gettext("Run on"), capitalise_first_letter(run_platform_name)]));

                    return tooltip;
                },
                html: true,
                placement: 'left',
                animation: false,
                delay: {show: 250},
                container: 'body'
            }).click(function() { $(this).popover('hide'); });

            ib_btn.click(toggle_ib);

            button_holder.append(error_area);
            button_holder.append(run_btn);
            button_holder.append(save_btn);
            button_holder.append(discard_btn);
            button_holder.append(rename_btn);

            if(source.indexOf('// BEGIN AUTO-GENERATED UI CODE; DO NOT MODIFY') != -1) {
                button_holder.append(ib_btn);
            }
            // You must have an app.js in pebblejs projects.
            if(CloudPebble.ProjectInfo.type != 'pebblejs' || file.name != 'app.js') {
                button_holder.append(delete_btn);
            }
            pane.append(button_holder);
            code_mirror.refresh();

            // Add fullscreen icon and click event
            var fullscreen_icon = $('<a href="#" class="fullscreen-icon open"></a><span class="fullscreen-icon-tooltip">' + gettext("Toggle Fullscreen") + '</span>');
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

            if(show_ui_editor === true) {
                toggle_ib();
            }

            if (resume_fullscreen) {
                fullscreen(code_mirror, true);
            }

            var commands = {};
            commands[gettext('Rename File')] = function() {
                // We need to use a timeout because the rename prompt will conflict with the old prompt
                setTimeout(show_rename_prompt, 0);
            };
            CloudPebble.FuzzyPrompt.ReplaceCommands(commands);

            // Tell Google
            ga('send', 'event', 'file', 'open');
            return code_mirror;
        }).catch(function(error) {
            var error_box = $('<div class="alert alert-error"></div>');
            error_box.text(interpolate(gettext("Something went wrong: %s"), [error.message]));
            CloudPebble.Sidebar.SetActivePane(error_box, {id: ''});
        }).finally(function() {
            CloudPebble.ProgressBar.Hide();
        });
    };

    var save_all = function() {
        return Promise.all(_.map(open_codemirrors, function(cm) {
            return cm.cloudpebble_save();
        }));
    };

    function init() {
        init_create_prompt();
        CodeMirror.commands.autocomplete = function(cm) {
            cm.showHint({hint: CloudPebble.Editor.Autocomplete.complete, completeSingle: false});
        };
        CodeMirror.commands.save = function(cm) {
            cm.cloudpebble_save().catch(alert);;
        };
        CodeMirror.commands.saveAll = function(cm) {
            save_all().catch(alert);
        };

        CloudPebble.FuzzyPrompt.AddDataSource('files', function() {
            var names = _.countBy(project_source_files, 'name');
            return _.map(project_source_files, function(obj) {
                return {
                    file: obj,
                    name: (names[obj.name] > 1 ? interpolate("%s (%s)", [obj.name, CloudPebble.TargetNames[obj.target]]) : obj.name)
                }
            });
            // return project_source_files;
        }, function(item, querystring) {
            // When a file is selected in fuzzy search, 'edit' or 'go_to'
            // depending on whether the user included :<line-number>
            var parts = querystring.split(":", 2);
            var line = parseInt(parts[1], 10);
            if (_.isFinite(line)) {
                go_to(item.file, line - 1, 0);
            }
            else {
                edit_source_file(item.file);
            }
        });
        var commands = {};
        if (CloudPebble.ProjectProperties.is_runnable) {
            commands[gettext('Run')] = run;
        } else {
            commands[gettext('Build')] = run;
        }
        
        CloudPebble.FuzzyPrompt.AddCommands(commands);

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
            resume_fullscreen = false;
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

        var result = [[gettext('Declaration'), sig_element]];

        if(doc.description) {
            result.push([gettext('Description'), $('<div>').html(doc.description)]);
        }

        if(doc.return_desc) {
            result.push([gettext('Returns'), doc.return_desc]);
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
                result.push([gettext('Parameters'), table]);
        }

        if(doc.warning) {
            result.push([gettext('Note'), $('<strong>').html(doc.warning)]);
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
            };
            var handler = function(e) {
                if(e.keyCode == 27) { // esc
                    remove();
                }
            };

            $('body').one('mouseup', remove);
            $('body').on('keydown', handler);
        }, 1);
    }

    function create_remote_file(params) {
        if(_.isString(params)) {
            params = {name: params};
        }
        ga('send', 'event', 'file', 'create');
        return Ajax.Post("/ide/project/" + PROJECT_ID + "/create_source_file", params).then(function(data) {
            CloudPebble.YCM.createFile(data.file, params.content);
            add_source_file(data.file);
            return data;
        });

    }

    function init_create_prompt() {
        var prompt = $('#editor-new-file-prompt');
        var file_type_picker = prompt.find('#new-file-type');
        var js_target_picker = prompt.find('#new-js-target');

        function get_default_js_name() {
            // If js files don't exist for a certain target, set the name to the default
            // and hide the name input.
            if (CloudPebble.ProjectInfo.sdk_version == '2') return null;
            var js_name_override = null;
            var required_js = [
                {target: 'pkjs', requires: 'index.js'},
                {target: 'app', requires: 'index.js', project_type:'rocky'}
            ];
            var current_target = get_js_target();
            _.some(required_js, function(spec) {
                if (!spec.project_type || CloudPebble.ProjectInfo.type == spec.project_type) {
                    if (current_target == spec.target && !_.some(project_source_files, function(x) {return x.target==spec.target && x.name.endsWith('.js')})) {
                        js_name_override = spec.requires;
                        return true;
                    }
                }
            });

            return js_name_override;
        }

        function toggle_js_filename() {
            var show_name = get_default_js_name() == null;
            $('#js-file-name-option').toggle(show_name);
        }

        function get_js_target(selector) {
            var target = !!selector ? prompt.find(selector + ':visible').val() : null;
            if (!target) {
                target = _.contains(['native', 'package'], CloudPebble.ProjectInfo.type) ? 'pkjs': 'app';
            }
            return target;
        }

        file_type_picker.change(function() {
            prompt.find('.file-group').hide();
            prompt.find('.' + $(this).val() + '-file-options').show();
            if($(this).val() == 'js') {
                toggle_js_filename();
            }
        });
        js_target_picker.change(toggle_js_filename);



        // If this isn't a native project or package, only JS and JSON files should exist.
        if(CloudPebble.ProjectProperties.js_only) {
            file_type_picker.val('js').change();
            file_type_picker.find('option').filter(function() {
                return !(this.value == 'js' || this.value == 'json' || this.value == 'rocky');
            }).remove();
        }

        prompt.find('#editor-create-file-button').click(function() {
            var kind = file_type_picker.val();
            var error = prompt.find('.alert');
            var files = [];
            // do stuff.
            if(kind == 'c') {
                (function() { // for scoping reasons, mostly.
                    var name = prompt.find('#new-c-file-name').val();
                    var target = prompt.find('#new-c-target').val();
                    if (!(/.+\.(c|h)$/.test(name))) {
                        error.text(gettext("Source files must end in .c or .h")).show();
                    } else {
                        // Should we create a header?
                        var header = null;
                        if (prompt.find('#new-c-generate-h').is(':checked')) {
                            // Drop the .c to make a .h
                            var split_name = name.split('.');
                            if (split_name.pop() == 'c') {
                                header = split_name.join('.') + '.h';
                                files.push({
                                    name: header,
                                    content: "#pragma once\n",
                                    target: target
                                });
                            }
                        }
                        var content = "#include <pebble" + (target == 'worker' ? '_worker' : '') +".h>\n";
                        if(header) {
                            content += '#include "' + header + '"\n\n';
                        }
                        files.unshift({
                            name: name,
                            content: content,
                            target: target
                        });
                    }
                })();
            } else if(kind == 'js') {
                (function() {
                    var target = get_js_target('#new-js-target');
                    var default_name = get_default_js_name();
                    var name = (default_name !== null ? default_name : prompt.find('#new-js-file-name').val());
                    if(!/.+\.js$/.test(name)) {
                        error.text(gettext("Source files must end in .js")).show();
                    } else {
                        files = [{name: name, target: target}]
                    }
                })();
            } else if(kind == 'json') {
                (function() {
                    var target = get_js_target('#new-json-target');
                    var name = prompt.find('#new-json-file-name').val();
                    if(!/.+\.json?$/.test(name)) {
                        error.text(gettext("JSON files must end in .json")).show();
                    } else {
                        files = [{name: name, target: target}]
                    }
                })();
            } else if(kind == 'layout') {
                (function() {
                    var name = prompt.find('#new-window-name').val();
                    if(!/^[a-z]([a-z0-9_]*[a-z0-9])?$/.test(name)) {
                        error.text(gettext("You must specify a valid window name using lowercase letters and underscores.")).show();
                    } else {
                        var h_file = {
                            name: name + ".h",
                            target: 'app',
                            content: "void show_" + name + "(void);\nvoid hide_" + name + "(void);\n",
                        };
                        var c_file = {
                            name: name + ".c",
                            target: 'app',
                            content: "#include <pebble.h>\n#include \"" + name + ".h\"\n\n" +
                                "// BEGIN AUTO-GENERATED UI CODE; DO NOT MODIFY\n" +
                                "static void destroy_ui(void) {}\n" +
                                "static void initialise_ui(void) {}\n" +
                                "// END AUTO-GENERATED UI CODE\n\n" +
                                "static void handle_window_unload(Window* window) {\n" +
                                "  destroy_ui();\n" +
                                "}\n\n" +
                                "void show_" + name + "(void) {\n" +
                                "  initialise_ui();\n" +
                                "  window_set_window_handlers(s_window, (WindowHandlers) {\n" +
                                "    .unload = handle_window_unload,\n" +
                                "  });\n" +
                                "  window_stack_push(s_window, true);\n" +
                                "}\n\n" +
                                "void hide_" + name + "(void) {\n" +
                                "  window_stack_remove(s_window, true);\n" +
                                "}\n"
                        };
                        files = [c_file, h_file];
                        CloudPebble.Analytics.addEvent("cloudpebble_created_ui_layout", {name: name}, null, ['cloudpebble']);
                    }
                })();
            }
            if (files.length) {
                Promise.map(files, function(file) {
                    if (file_with_name_and_target_exists(file.name, file.target)) {
                        throw new Error(interpolate(gettext("A file of called '%s' of type '%s' already exists."), [file.name, CloudPebble.TargetNames[file.target]]));
                    }
                    return create_remote_file(file);
                }).then(function(new_files) {
                    prompt.modal('hide');
                    return edit_source_file(new_files[0].file, kind == 'layout');
                }).catch(function(err) {
                    error.text(err.toString()).show();
                });
            }
        });

        prompt.find('.c-file-options .field-help').popover({
            trigger: 'hover',
            content: "<p>"+gettext("If you want to create a background worker, use this dropdown to create files pointing at that target.") + "</p>" +
                     "<p>"+gettext("Note that targets are independent and code will not be shared between them.") + "</p>",
            html: true,
            container: '#help-prompt-holder',
            placement: 'bottom',
            animation: false
        });
        prompt.find('.rocky-only .field-help').popover({
            trigger: 'hover',
            content: "<p>"+gettext("Use this dropdown to select whether the javascript code will be run on the watch or the phone.") + "</p>" +
                     "<p>"+gettext("JS code is shared between both devices only when using the 'Shared' target.") + "</p>",
            html: true,
            container: '#help-prompt-holder',
            placement: 'bottom',
            animation: false
        });
    }

    function create_source_file() {
        var prompt = $('#editor-new-file-prompt');
        // reset the prompt
        prompt.find('.alert').text('').hide();
        prompt.find('input[type=text]').val('');
        prompt.find('#new-file-type').change();
        prompt.modal('show');
    }

    function go_to(file_info, line, ch) {
        // Assume that we passed the actual file if the lastModified key is present.
        // Otherwise, look up the file by they keys.
        var file = file_info.lastModified ? file_info : _.findWhere(project_source_files, file_info);
        if(!file) {
            return Promise.reject(new Error(gettext("File not found")));
        }
        else {
            return edit_source_file(file, false).then(function(cm) {
                if (cm) {
                    cm.scrollIntoView({line: line, ch: ch});
                    cm.setCursor({line: line, ch: ch});
                    cm.focus();
                }
            });
        }
    }

    return {
        Create: function() {
            create_source_file();
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
        SaveAll: function() {
            return save_all();
        },
        GoTo: function(file_info, line, ch) {
            return go_to(file_info, line, ch);
        },
        GetAllEditors: function() {
            return open_codemirrors;
        },
        GetAllFiles: function() {
            return project_source_files;
        },
        RenameFile: function(file, new_name) {
            return rename_file(file, new_name)
        }
    };
})();
