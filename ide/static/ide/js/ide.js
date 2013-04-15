jquery_csrf_setup();

(function() {
    var project_source_files = {};
    var suspended_panes = {};

    function add_source_file(file) {
        var end = $('#end-source-files');
        var link = $('<a href="#"></a>');
        link.text(file.name + ' ');
        link.click(function() {
            edit_source_file(file);
        });
        var li = $('<li id="sidebar-pane-source-'+file.id+'">');
        li.append(link);
        end.before(li);
        project_source_files[file.name] = file;
    }

    function suspend_active_pane() {
        var pane_id = $('#main-pane').data('pane-id');
        if(!pane_id) {
            $('#pane-parent').html('').append($('<div id="main-pane"></div>'));
            return;
        };
        var pane = $('#main-pane');

        var suspend_function = pane.data('pane-suspend-function');
        if(suspend_function) suspend_function();

        var list_entry = $('#sidebar-pane-' + pane_id);
        if(list_entry) {
            list_entry.removeClass('active');
        }
        suspended_panes[pane_id] = pane;
        pane.detach();
        // Create a new empty one.
        var empty_pane = $('<div id="main-pane"></div>');
        $('#pane-parent').append(empty_pane);
    }

    function destroy_active_pane() {
        var pane_id = $('#main-pane').data('pane-id');
        $('#pane-parent').html('');
        var list_entry = $('#sidebar-pane-' + pane_id);
        if(list_entry) {
            list_entry.removeClass('active');
        }
    }

    function restore_suspended_pane(id) {
        var pane = suspended_panes[id] 
        if(pane) {
            $('#pane-parent').html('').append(pane);
            delete suspended_panes[id];

            var list_entry = $('#sidebar-pane-' + id);
            if(list_entry) {
                list_entry.addClass('active');
            }

            if(pane.data('pane-restore-function')) {
                pane.data('pane-restore-function')();
            }

            return true;
        }
        return false;
    }

    function edit_source_file(file) {
        // See if we already had it open.
        suspend_active_pane();
        if(restore_suspended_pane('source-'+file.id)) {
            return;
        }

        // Open it.
        $.getJSON('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/load', function(data) {
            var pane = $('#main-pane');
            if(!data.success) {
                var error = $('<div class="alert alert-error"></div>');
                error.text("Something went wrong: " + data.error);
                pane.append(error);
            } else {
                var source = data.source;
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
                    mode: PebbleMode,
                    styleActiveLine: true,
                    value: source
                });
                var browserHeight = document.documentElement.clientHeight;
                code_mirror.getWrapperElement().style.height = (browserHeight - 130) + 'px';
                code_mirror.refresh();
                pane.data('pane-id', 'source-' + file.id);
                pane.data('pane-restore-function', function() {
                    code_mirror.refresh();
                    code_mirror.focus();
                });

                var list_entry = $('#sidebar-pane-source-' + file.id);
                if(list_entry) {
                    list_entry.addClass('active');
                }

                var was_clean = true;
                code_mirror.on('change', function() {
                    if(was_clean) {
                        $('#sidebar-pane-source-' + file.id).find('a').append($('<i class="icon-edit">'));
                        was_clean = false;
                    }
                });

                function save() {
                    save_btn.attr('disabled','disabled');
                    delete_btn.attr('disabled','disabled');
                    $.post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/save", {'content': code_mirror.getValue()}, function(data) {
                        save_btn.removeAttr('disabled');
                        delete_btn.removeAttr('disabled');
                        if(data.success) {
                            was_clean = true;
                            $('#sidebar-pane-source-' + file.id).find('a > i').remove();
                        } else {
                            alert(data.error);
                        }
                    });
                }

                // Add some buttons
                var button_holder = $('<p style="padding-top: 5px; text-align: right;">');
                var save_btn = $('<button class="btn btn-primary">Save</button>');
                var delete_btn = $('<button class="btn btn-danger" style="margin-right: 20px;">Delete</button>');
                var error_area = $('<div>');

                save_btn.click(save);
                delete_btn.click(function() {
                    modal_confirmation_prompt("Do you want to delete " + file.name + "?", "This cannot be undone.", function() {
                        save_btn.attr('disabled','disabled');
                        delete_btn.attr('disabled','disabled');
                        $.post("/ide/project/" + PROJECT_ID + "/source/" + file.id + "/delete", function(data) {
                            save_btn.removeAttr('disabled');
                            delete_btn.removeAttr('disabled');
                            if(data.success) {
                                destroy_active_pane();
                                delete project_source_files[file.name];
                                list_entry.remove();
                            } else {
                                alert(data.error);
                            }
                        });
                    });
                });

                button_holder.append(error_area);
                button_holder.append(delete_btn);
                button_holder.append(save_btn);
                pane.append(button_holder);
            }
        });
    }



    // Load in project data.
    $.getJSON('/ide/project/' + PROJECT_ID + '/info.json', function(data) {
        if(!data.success) {
            alert("Something went wrong:\n" + data.error);
            return;
        }

        // Add source files.
        console.log(data);
        $.each(data.source_files, function(index, value) {
            add_source_file(value);
        });
    });

    // Implement the add source file button
    $('#new-source-file').click(function() {
        modal_text_prompt("New Source File", "Enter a name for the new file", "somefile.c", '', function(value, resp) {
           if(value == '') {
                resp.error("You must specify a filename.");
            } else if(!(/\.h$/.test(value) || /\.c$/.test(value))) {
                resp.error("Source files must end in .c or .h");
            } else if(project_source_files[value]) {
                resp.error("A file called '" + value + "' already exists.");
            } else {
                resp.disable();
                $.post("/ide/project/" + PROJECT_ID + "/create_source_file", {'name': value}, function(data) {
                    console.log(data);
                    if(!data.success) {
                        resp.error(data.error);
                    } else {
                        resp.dismiss();
                        add_source_file(data.file);
                    }
                });
            }
        });
    });

    function modal_text_prompt(title, prompt, placeholder, default_value, callback) {
        $('#modal-text-input-title').text(title);
        $('#modal-text-input-prompt').text(prompt);
        $('#modal-text-input-value').val(default_value).attr('placeholder', placeholder);
        $('#modal-text-input-errors').html('');
        $('#modal-text-input').modal();
        $('#modal-text-input-value').removeAttr('disabled');
        $('#modal-text-confirm-button').unbind('click').click(function() {
            console.log('eep');
            callback($('#modal-text-input-value').val(), {
                error: function(message) {
                    $('#modal-text-input-value').removeAttr('disabled');
                    $('#modal-text-input-confirm-button').removeClass('disabled');
                    var alert = $('<div class="alert alert-error"></div>');
                    alert.text(message);
                    $('#modal-text-input-errors').html('').append(alert);
                },
                disable: function() {
                    $('#modal-text-input-value').attr('disabled', 'disabled');
                    $('#modal-text-input-confirm-button').addClass('disabled');
                },
                dismiss: function() {
                    $('#modal-text-input').modal('hide');
                }
            });
        });
    }

    function modal_confirmation_prompt(title, prompt, callback) {
        $('#modal-warning-prompt-title').text(title);
        $('#modal-warning-prompt-warning').text(prompt);
        $('#modal-warning-prompt').modal();
        $('#modal-warning-prompt-button').unbind('click').click(function() {
            $('#modal-warning-prompt').modal('hide');
            callback();
        });
    }
})();
