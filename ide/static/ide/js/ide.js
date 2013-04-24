jquery_csrf_setup();

(function() {
    var project_source_files = {};
    var project_resources = {};
    var suspended_panes = {};

    var ProjectInfo = {};

    var add_source_file = function(file) {
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

    var add_resource = function(resource) {
        var end = $('#end-resources-' + resource.kind);
        if(!end.length) {
            // Create an appropriate section
            var res_end = $('#end-resources');
            end = $('<li id="end-resources-' + resource.kind + '" class="divider">');
            res_end.before(end);
        }
        var link = $('<a href="#"></a>').text(resource.file_name).click(function() {
            edit_resource(resource);
        });
        var li = $('<li id="sidebar-pane-resource-' + resource.id + '">');
        li.append(link);
        end.before(li);
        update_resource(resource);
    }

    var update_resource = function(resource) {        
        project_resources[resource.file_name] = resource
        console.log($('#sidebar-pane-resource-' + resource.id));
        $('#sidebar-pane-resource-' + resource.id).popover('destroy').popover({
            trigger: 'hover',
            title: 'Identifier' + (resource.identifiers.length != 1 ? 's' : ''),
            content: resource.identifiers.join('<br>'),
            html: true,
            delay: {show: 250}
        }).click(function() { $(this).popover('hide')});
    }

    var suspend_active_pane = function() {
        var pane_id = $('#main-pane').data('pane-id');
        if(!pane_id) {
            $('#main-pane').remove();
            $('#pane-parent').append($('<div id="main-pane"></div>'));
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

    var destroy_active_pane = function() {
        var pane_id = $('#main-pane').data('pane-id');
        $('#main-pane').remove();
        var list_entry = $('#sidebar-pane-' + pane_id);
        if(list_entry) {
            list_entry.removeClass('active');
        }
    }

    var restore_suspended_pane = function(id) {
        var pane = suspended_panes[id] 
        if(pane) {
            $('#main-pane').remove()
            $('#pane-parent').append(pane);
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

    var edit_source_file = function(file) {
        // See if we already had it open.
        suspend_active_pane();
        if(restore_suspended_pane('source-'+file.id)) {
            return;
        }
        $('#progress-pane').removeClass('hide');

        // Open it.
        $.getJSON('/ide/project/' + PROJECT_ID + '/source/' + file.id + '/load', function(data) {
            $('#progress-pane').addClass('hide');
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
                    value: source,
                    theme: 'monokai',
                    extraKeys: {
                        'Ctrl-S': function(instance) {
                            save()
                        },
                        'Cmd-S': function(instance) {
                            save()
                        }
                    }
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

                function mark_clean() {
                    was_clean = true;
                    $('#sidebar-pane-source-' + file.id).find('a > i').remove();
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

                discard_btn.click(function() {
                    modal_confirmation_prompt(
                        "Do you want to reload " + file.name + "?",
                        "This will discard your current changes and revert to the saved version.",
                        function() {  
                            destroy_active_pane();
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
            }
        });
    }

    var process_resource_form = function(form, is_new, url, callback) {
        var report_error = function(message) {
            form.find('.alert:first').removeClass("hide").text(message);
        }
        var remove_error = function() {
            form.find('.alert:first').addClass("hide");
        }
        var disable_controls = function() {
            form.find('input, button, select').attr('disabled', 'disabled');
        }
        var enable_controls = function() {
            if(is_new) {
                form.find('input, button, select').removeAttr('disabled');
            } else {
                form.find('input, button').removeAttr('disabled');
            }
        }

        remove_error();
        var files = form.find('#edit-resource-file').get(0).files;
        var file = (files.length > 0) ? files[0] : null;
        if(is_new) {
            if(files.length != 1) {
                report_error("You must upload a file.");
                return;
            }
            if(!!project_resources[file.name]) {
                report_error("A resource called '" + file.name + "' already exists in the project.");
                return;
            }
        }
        var kind = form.find('#edit-resource-type').val();
        if(files.length == 1) {
            if((kind == 'png' || kind == 'png-trans') && file.type != "image/png") {
                report_error("You must upload a PNG image.");
                return;
            }
            if(kind == 'font' && !/\.ttf$/i.test(file.name)) {
                report_error("You must upload a TrueType Font (.ttf)");
                return;
            }
        }
        var resources = [];
        if(kind != 'font') {
            var resource_id = form.find('#non-font-resource-group .edit-resource-id').val();
            if(resource_id == '' || !validate_resource_id(resource_id)) {
                report_error("You must provide a valid resource identifier. Use only letters, numbers and underscores.");
                return;
            }
            resources = [{'id': resource_id}];
        } else {
            var resource_ids = {};
            var okay = true;
            $.each(form.find('.font-resource-group-single'), function(index, value) {
                value = $(value);
                var resource_id = value.find('.edit-resource-id').val();
                var regex = value.find('.edit-resource-regex').val();
                if(resource_id == '') return true; // continue
                if(!validate_resource_id(resource_id)) {
                    report_error("Invalid resource identifier. Use only letters, numbers and underscores.");
                    okay = false;
                    return false;
                }
                if(!/[0-9]+$/.test(resource_id)) {
                    report_error("Font resource identifiers must end with the desired font size, e.g. " + resource_id + "_24");
                    okay = false;
                    return false;
                }
                if(!!resource_ids[resource_id]) {
                    report_error("You can't have multiple identical identifiers. Please remove or change one.");
                    okay = false; return;
                }
                resource_ids[resource_id] = true;
                resources.push({'id': resource_id, 'regex': regex});
            });
            if(!okay) return;
            if(resources.length == 0) {
                report_error("You must specify at least one resource.");
                return;
            }
        }
        var form_data = new FormData();
        form_data.append("kind", kind);
        form_data.append("file", file);
        form_data.append("resource_ids", JSON.stringify(resources));
        disable_controls();
        $.ajax({
            url: url,
            type: "POST",
            data: form_data,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: function(data) {
                enable_controls();
                if(data.success) {
                    callback(data.file);
                } else {
                    report_error(data.error);
                }
            }
        });
    }

    var edit_resource = function(resource) {
        suspend_active_pane();
        if(restore_suspended_pane('resource-' + resource.id)) return;
        $('#progress-pane').removeClass('hide');
        $.getJSON("/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/info", function(data) {
            $('#progress-pane').addClass('hide');
            console.info(data);
            if(!data.success) return;
            var resource = data.resource;
            var pane = prepare_resource_pane();
            var list_entry = $('#sidebar-pane-resource-' + resource.id);
            var preview_img = null;
            var preview_count = 0;
            if(list_entry) {
                list_entry.addClass('active');
            }

            $('#main-pane').data('pane-id', 'resource-' + resource.id);
            pane.find('#edit-resource-type').val(resource.kind).attr('disabled', 'disabled');
            pane.find('label[for="edit-resource-file"]').text("Replace with new file");
            pane.find('#edit-resource-file').after($("<span class='help-block'>If specified, this file will replace the current file for this resource, regardless of its filename.</span>"));

            // Generate a preview.
            var preview_url = '/ide/project/' + PROJECT_ID + '/resource/' + resource.id +'/get';
            if(resource.kind == 'png' || resource.kind == 'png-trans') {
                var div = $('<div class="span4 text-center">');
                preview_img = $('<img class="img-polaroid">');
                preview_img.attr('src', preview_url);
                div.append(preview_img);
                var dimensions = $('<p class="muted">');
                preview_img.load(function() {
                    dimensions.text(preview_img.width() + ' x ' + preview_img.height());
                });
                div.append(dimensions);
                $('.resource-type-column').removeClass('span12').addClass('span8').before(div);
            } else if(resource.kind == 'font') {
                var style = document.createElement('style');
                ++preview_count;
                var rule = '@font-face { font-family: "font-preview-' + resource.id + '-' + (preview_count) + '"; src: url(' + preview_url + '#e' + (preview_count) + '); }';
                style.appendChild(document.createTextNode(rule));
                $('body').append(style);
            }
            pane.find('.resource-download-link').removeClass('hide').find('a').attr('href', preview_url);

            var update_font_preview = function(group) {
                group.find('.font-preview').remove();
                var regex_str = group.find('.edit-resource-regex').val();
                var id_str = group.find('.edit-resource-id').val();
                try {
                    var preview_regex = new RegExp(regex_str ? regex_str : '.', 'g');
                    group.find('.font-resource-regex-group').removeClass('error').find('.help-block').text("A PCRE regular expression that restricts characters.");
                } catch(e) {
                    group.find('.font-resource-regex-group').addClass('error').find('.help-block').text(e);
                }
                var row = $('<div class="control-group font-preview"><label class="control-label">Preview</label>');
                var preview = $('<div class="controls">');
                var line1 = ('abcdefghijklmnopqrstuvwxyz'.match(preview_regex)||[]).join('');
                var line2 = ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.match(preview_regex)||[]).join('');
                var line3 = ('0123456789'.match(preview_regex) || []).join('');
                var line4 = ('~!@#$%^& *()_+[]{}\\|;:\'"<>?`'.match(preview_regex)||[]).join('');
                var font_size = id_str.match(/[0-9]+$/)[0]
                preview.html(line1 + (line1 ? "<br>" : '') + line2 + (line2 ? "<br>" : '')+ line3 + (line3 ? "<br>" : '')+ line4);
                // 
                preview.css({
                    'font-family': 'font-preview-' + resource.id + '-' + preview_count,
                    'font-size': font_size * (72 / 175.2) + 'pt',
                    'line-height': font_size * (72 / 175.2)  + 'pt'
                });
                row.append(preview);
                group.append(row);
            }


            if(resource.kind != 'font') {
                if(resource.resource_ids.length > 0) {
                    pane.find('#non-font-resource-group .edit-resource-id').val(resource.resource_ids[0].id);
                }
            } else {
                pane.find('#non-font-resource-group').addClass('hide');
                var template = pane.find('.font-resource-group-single').detach();
                var parent = $('#font-resource-group').removeClass('hide');
                $.each(resource.resource_ids, function(index, value) {
                    var group = template.clone();
                    group.removeClass('hide').attr('id','');
                    group.find('.edit-resource-id').val(value.id);
                    group.find('.edit-resource-regex').val(value.regex);
                    update_font_preview(group);
                    group.find('input[type=text]').keyup(function() {
                        update_font_preview(group);
                    });
                    parent.append(group);
                });
                pane.find('#add-font-resource').removeClass('hide').click(function() {
                    var clone = parent.find('.font-resource-group-single:last').clone(false);
                    if(!clone.length) {
                        clone = template.clone().removeClass('hide').attr('id','');
                    }
                    parent.append(clone);
                    
                    console.log(clone.find('input[type=text]'));
                    clone.find('input[type=text]').keyup(function() {
                        console.log(clone);
                        update_font_preview(clone);
                    })
                });
            }

            pane.find('#edit-resource-delete').removeClass('hide').click(function() {
                modal_confirmation_prompt("Do you want to delete " + resource.file_name + "?", "This cannot be undone.", function() {
                    pane.find('input, button, select').attr('disabled', 'disabled');
                    $.post("/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/delete", function(data) {
                        pane.find('input, button, select').removeAttr('disabled');
                        if(data.success) {
                            destroy_active_pane();
                            delete project_resources[resource.file_name];
                            list_entry.remove();
                        } else {
                            alert(data.error);
                        }
                    });
                });
            });

            var form = pane.find('form');
            form.submit(function(e) {
                e.preventDefault();
                process_resource_form(form, false, "/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/update", function(data) {
                    // Update any previews we have.
                    if(preview_img) {
                        preview_img.attr('src', preview_img.attr('src').replace(/#e.*$/,'') + '#e' + (++preview_count));
                    }
                    if(resource.kind == 'font') {
                        var style = document.createElement('style');
                        ++preview_count;
                        var rule = '@font-face { font-family: "font-preview-' + resource.id + '-' + (preview_count) + '"; src: url(' + preview_url + '#e' + (preview_count) + '); }';
                        style.appendChild(document.createTextNode(rule));
                        $('body').append(style);
                        $.each(pane.find('.font-resource-group-single'), function(index, group) {
                            update_font_preview($(group));
                        });
                    }
                    // Update our information about the resource.
                    update_resource(data);
                });
            });

        });
    }

    // Set up the resource editing template.
    var resource_template = $('#resource-pane-template');
    resource_template.remove();

    var prepare_resource_pane = function() {
        var template = resource_template.clone();
        template.removeClass('hide');
        $('#main-pane').append(template).data('pane-id', 'new-resource');

        template.find('#edit-resource-type').change(function() {
            if($(this).val() == 'font') {
                template.find('#non-font-resource-group').addClass('hide');
                template.find('#font-resource-group').removeClass('hide');
                template.find('#add-font-resource').removeClass('hide');
            } else {
                template.find('#font-resource-group').addClass('hide');
                template.find('#non-font-resource-group').removeClass('hide');
                template.find('#add-font-resource').addClass('hide');
            }
        });
        return template;
    }

    var validate_resource_id = function(id) {
        if(/[^a-zA-Z0-9_]/.test(id)) {
            return false;
        }
        return true;
    }

    var create_new_resource = function() {
        suspend_active_pane();
        if(restore_suspended_pane('new-resource')) return;
        var list_entry = $('#sidebar-pane-new-resource');
        if(list_entry) {
            list_entry.addClass('active');
        }
        var pane = prepare_resource_pane();
        var form = pane.find('form');

        form.submit(function(e) {
            e.preventDefault();
            process_resource_form(form, true, "/ide/project/" + PROJECT_ID + "/create_resource", function(data) {
                destroy_active_pane();
                resource_created(data);
            });
        });
    }

    var resource_created = function(resource) {
        // Add it to our resource list
        add_resource(resource);
        edit_resource(resource);
    }

    var COMPILE_SUCCESS_STATES = {
        1: {english: "Pending", cls: "info", label: 'info'},
        2: {english: "Failed", cls: "error", label: 'important'},
        3: {english: "Succeeded", cls: "success", label: 'success'}
    }

    var build_history_row = function(build) {
        var tr = $('<tr>');
        tr.append($('<td>' + (build.id === null ? '?' : build.id) + '</td>'));
        tr.append($('<td>' + format_datetime(build.started) + '</td>'));
        tr.append($('<td>' + COMPILE_SUCCESS_STATES[build.state].english + '</td>'));
        tr.append($('<td>' + (build.state == 3 ? ('<a href="'+build.pbw+'">pbw</a>') : ' ') + '</td>'));
        tr.append($('<td>' + (build.state > 1 ? ('<a href="'+build.log+'">build log</a>') : ' ' )+ '</td>'));
        tr.addClass(COMPILE_SUCCESS_STATES[build.state].cls);
        return tr
    }

    var update_build_history = function(pane) {
        $.getJSON('/ide/project/' + PROJECT_ID + '/build/history', function(data) {
            $('#progress-pane').addClass('hide');
            pane.removeClass('hide');
            if(!data.success) {
                alert("Something went wrong:\n" + data.error); // This should be prettier.
                destroy_active_pane();
                return;
            }
            if(data.builds.length > 0) {
                update_last_build(pane, data.builds[0]);
            } else {
                update_last_build(pane, null);
            }
            pane.find('#run-build-table').html('')
            $.each(data.builds, function(index, value) {
                pane.find('#run-build-table').append(build_history_row(value));
            });
            if(data.builds.length > 0 && data.builds[0].state == 1) {
                setTimeout(function() { update_build_history(pane) }, 1000);
            }
        });
    }

    var show_compile_pane = function(resource) {
        suspend_active_pane();
        if(restore_suspended_pane("compile")) {
            return;
        }
        $('#progress-pane').removeClass('hide');
        $('#sidebar-pane-compile').addClass('active');
        var main_pane = $('#main-pane');
        var pane = $('#compilation-pane-template').clone();
        // Get build history
        update_build_history(pane);
        pane.find('#compilation-run-build-button').click(function() {
            var temp_build = {started: (new Date()).toISOString(), finished: null, state: 1, uuid: null, id: null};
            update_last_build(pane, temp_build);
            pane.find('#run-build-table').prepend(build_history_row(temp_build));
            $.post('/ide/project/' + PROJECT_ID + '/build/run', {}, function() {
                update_build_history(pane);
            })
        });
        main_pane.append(pane);
        main_pane.data('pane-id','compile');
    }

    var update_last_build = function(pane, build) {
        if(build == null) {
            pane.find('#last-compilation').addClass('hide');
            pane.find('#compilation-run-build-button').removeAttr('disabled');
        } else {
            pane.find('#last-compilation').removeClass('hide');
            pane.find('#last-compilation-started').text(format_datetime(build.started));
            if(build.state > 1) {
                pane.find('#last-compilation-time').removeClass('hide').find('span').text(format_interval(build.started, build.finished));
                pane.find('#last-compilation-log').removeClass('hide').find('a').attr('href', build.log);
                pane.find('#compilation-run-build-button').removeAttr('disabled');
                if(build.state == 3) {
                    pane.find('#last-compilation-pbw').removeClass('hide').find('a').attr('href', build.pbw);
                    var url = build.pbw;
                    pane.find('#last-compilation-qr-code').removeClass('hide').find('img').attr('src', 'https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl='+url+'&choe=UTF-8');
                }
            } else {
                pane.find('#last-compilation-time').addClass('hide');
                pane.find('#last-compilation-log').addClass('hide');
                pane.find('#compilation-run-build-button').attr('disabled', 'disabled');
            }
            if(build.state != 3) {
                pane.find('#last-compilation-pbw').addClass('hide');
                pane.find('#last-compilation-qr-code').addClass('hide');
            }
            pane.find('#last-compilation-status').removeClass('label-success label-error label-info').addClass('label-' + COMPILE_SUCCESS_STATES[build.state].label).text(COMPILE_SUCCESS_STATES[build.state].english)
        }
    }

    var format_datetime = function(str) {
        var date = new Date(Date.parse(str.replace(' ', 'T')));
        return date.toLocaleString();
    }

    var format_interval = function(s1, s2) {
        var t = Math.round(Math.abs(Date.parse(s2.replace(' ','T')) - Date.parse(s1.replace(' ','T'))) / 1000);
        return t.toFixed(0) + " second" + (t == 1 ? '' : 's');
    }

    var show_settings_pane = function() {
        suspend_active_pane();
        if(restore_suspended_pane("settings")) {
            return;
        }
        $('#sidebar-pane-settings').addClass('active');
        var main_pane = $('#main-pane');
        var pane = settings_template.clone(); // This clone is basically unncessary, since only one such pane can ever exist.
        var display_error = function(message) {
            pane.find('.alert').addClass('alert-error').removeClass('hide').text(message);
        }

        var display_success = function(message) {
            pane.find('.alert').addClass('alert-success').removeClass('hide').text(message);
        }
        
        pane.find('#settings-name').val(ProjectInfo.name);
        pane.find('#settings-version-def-name').val(ProjectInfo.version_def_name);
        pane.find('form').submit(function(e) {e.preventDefault();});
        pane.find('#project-save').click(function() {
            var name = pane.find('#settings-name').val();
            var version_def_name = pane.find('#settings-version-def-name').val();

            if(name.replace(/\s/g, '') == '') {
                display_error("You must specify a project name");
                return;
            }

            if(version_def_name.replace(/\s/g, '') == '') {
                display_error("You must specify a versionDefName (how about APP_RESOURCES?)");
                return;
            }

            pane.find('input, button, select').attr('disabled', 'disabled');

            $.post('/ide/project/' + PROJECT_ID + '/save_settings', {
                'name': name,
                'version_def_name': version_def_name
            }, function(data) {
                pane.find('input, button, select').removeAttr('disabled');
                pane.find('.alert').removeClass("alert-success alert-error").addClass("hide");
                if(data.success) {
                    ProjectInfo.name = name;
                    ProjectInfo.version_def_name = version_def_name;
                    $('.project-name').text(name);
                    window.document.title = "CloudPebble – " + name;
                    display_success("Settings saved.");
                } else {
                    display_error("Error: " + data.error);
                }
            });
        });

        pane.find('#project-delete').click(function() {
            modal_confirmation_prompt("Delete Project", "Are you sure you want to delete this project? THIS CANNOT BE UNDONE.", function() {
                $.post('/ide/project/' + PROJECT_ID + '/delete', {confirm: true}, function(data) {
                    if(data.success) {
                        window.location.href = "/ide/";
                    } else {
                        display_error("Error: " + data.error);
                    }
                })
            });
        });

        main_pane.append(pane);
        main_pane.data('pane-id','settings');
    }

    var settings_template = $('#settings-pane-template').remove().removeClass('hide');


    // Load in project data.
    $.getJSON('/ide/project/' + PROJECT_ID + '/info', function(data) {
        $('#progress-pane').addClass('hide');
        if(!data.success) {
            alert("Something went wrong:\n" + data.error);
            return;
        }
        ProjectInfo = data;

        // Add source files.
        $.each(data.source_files, function(index, value) {
            add_source_file(value);
        });

        $.each(data.resources, function(index, value) {
            add_resource(value);
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
    });

    // The add resource button
    $('#sidebar-pane-new-resource > a').click(create_new_resource);
    $('#sidebar-pane-compile > a').click(show_compile_pane);
    $('#sidebar-pane-settings > a').click(show_settings_pane);

    var modal_text_prompt =  function(title, prompt, placeholder, default_value, callback) {
        $('#modal-text-input-title').text(title);
        $('#modal-text-input-prompt').text(prompt);
        $('#modal-text-input-value').val(default_value).attr('placeholder', placeholder);
        $('#modal-text-input-errors').html('');
        $('#modal-text-input').modal();
        $('#modal-text-input-value').removeAttr('disabled');
        $('#modal-text-confirm-button').unbind('click').click(function() {
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

    var modal_confirmation_prompt = function(title, prompt, callback) {
        $('#modal-warning-prompt-title').text(title);
        $('#modal-warning-prompt-warning').text(prompt);
        $('#modal-warning-prompt').modal();
        $('#modal-warning-prompt-button').unbind('click').click(function() {
            $('#modal-warning-prompt').modal('hide');
            callback();
        });
    }
})();
