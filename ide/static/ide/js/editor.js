CloudPebble.Editor = (function() {
    var project_source_files = {};
    var unsaved_files = 0;

    var add_source_file = function(file) {
        CloudPebble.Sidebar.AddSourceFile(file, function() {
            edit_source_file(file);
        });

        project_source_files[file.name] = file;
    }

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
                var source = data.source;
                var pane = $('<div>');
                var is_autocompleting = false;
                var code_mirror = CodeMirror(pane[0], {
                    indentUnit: 4,
                    lineNumbers: true,
                    autofocus: true,
                    electricChars: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    //highlightSelectionMatches: true,
                    smartIndent: true,
                    indentWithTabs: true,
                    mode: CloudPebble.Editor.PebbleMode,
                    styleActiveLine: true,
                    value: source,
                    theme: 'monokai',
                    extraKeys: {
                        'Ctrl-S': function(instance) {
                            save()
                        },
                        'Cmd-S': function(instance) {
                            save()
                        }
                    },
                    onKeyEvent: function(cm, e) {
                        // This is kinda sketchy but seems to basically work.
                        if(e.type == "keyup") {
                            // This is a mess.
                            // The idea is to try and fire whenever we hit a key that could be part of an identifier, except when we're already
                            // showing an autocomplete prompt, or whenever that key is just noise.
                            if((e.keyCode >= 65 && e.keyCode <= 90) || (e.keyCode >= 65 && e.keyCode <= 122) || e.keyCode == 8 || (e.keyCode == 189 && e.shiftKey)) {
                                if(!is_autocompleting || e.which == 8) {
                                    CodeMirror.commands.autocomplete(cm);
                                }
                            }
                        }
                        return false;
                    }
                });
                code_mirror.on('close', function() {
                    is_autocompleting = false;
                });
                code_mirror.on('shown', function() {
                    is_autocompleting = true;
                })

                var fix_height = function() {
                    var browserHeight = document.documentElement.clientHeight;
                    code_mirror.getWrapperElement().style.height = (browserHeight - 130) + 'px';
                    code_mirror.refresh();
                }
                fix_height();
                $(window).resize(fix_height);

                CloudPebble.Sidebar.SetActivePane(pane, 'source-' + file.id, function() {
                    code_mirror.refresh();
                    code_mirror.focus();
                }, function() {
                    if(!was_clean) {
                        --unsaved_files;
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

                function mark_clean() {
                    was_clean = true;
                    --unsaved_files;
                    CloudPebble.Sidebar.ClearIcon('source-' + file.id);
                }

                function save() {
                    save_btn.attr('disabled','disabled');
                    delete_btn.attr('disabled','disabled');
                    $.post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/save", {'content': code_mirror.getValue()}, function(data) {
                        save_btn.removeAttr('disabled');
                        delete_btn.removeAttr('disabled');
                        if(data.success) {
                            mark_clean();
                        } else {
                            alert(data.error);
                        }
                    });
                }

                // Add some buttons
                var button_holder = $('<p style="padding-top: 5px; text-align: right;">');
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
                            } else {
                                alert(data.error);
                            }
                        });
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
                button_holder.append(delete_btn);
                button_holder.append(discard_btn);
                button_holder.append(save_btn);
                pane.append(button_holder);
                code_mirror.refresh();
            }
        });
    }

    function init() {
        CodeMirror.commands.autocomplete = function(cm) {
            CodeMirror.showHint(cm, CloudPebble.Editor.Autocomplete.Complete, {completeSingle: false});
        }
    }

    return {
        Create: function() {
            CloudPebble.Prompts.Prompt("New Source File", "Enter a name for the new file", "somefile.c", '', function(value, resp) {
               if(value == '') {
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
        }
    }
})();
