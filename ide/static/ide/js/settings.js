CloudPebble.Settings = (function() {
    var settings_template = null;
    var shared_pane = null;

    var show_settings_pane = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("settings")) {
            return;
        }
        ga('send', 'event', 'project', 'load settings');
        var pane = settings_template;
        shared_pane = pane;

        if(CloudPebble.ProjectInfo.type != 'native') {
            pane.find('.native-only').hide();
        }

        var display_error = function(message) {
            window.scrollTo(window.scrollX, 0);
            pane.find('.alert').addClass('alert-error').removeClass('hide').text(message);
            pane.find('input, button, select').removeAttr('disabled');
        };

        var display_success = function(message) {
            window.scrollTo(window.scrollX, 0);
            pane.find('.alert').addClass('alert-success').removeClass('hide').text(message);
            pane.find('input, button, select').removeAttr('disabled');
        };

        pane.find('#settings-name').val(CloudPebble.ProjectInfo.name);
        pane.find('#settings-version-def-name').val(CloudPebble.ProjectInfo.version_def_name);
        pane.find('form').submit(function(e) {e.preventDefault();});
        pane.find('#project-save').click(function() {
            var name = pane.find('#settings-name').val();
            var version_def_name = pane.find('#settings-version-def-name').val();
            var sdk_version = parseInt(pane.find('#settings-sdk-version').val(), 10);
            var short_name = pane.find('#settings-short-name').val();
            var long_name = pane.find('#settings-long-name').val();
            var company_name = pane.find('#settings-company-name').val();
            var version_code = pane.find('#settings-version-code').val();
            var version_label = pane.find('#settings-version-label').val();
            var app_uuid = pane.find('#settings-uuid').val();
            var app_is_watchface = pane.find('#settings-app-is-watchface').val();
            var app_keys = {};
            var app_jshint = pane.find('#settings-app-jshint').prop("checked") ? 1 : 0;
            var menu_icon = pane.find('#settings-menu-image').val();

            var app_capabilities = [];
            if(pane.find('#settings-capabilities-location').is(':checked')) {
                app_capabilities.push('location');
            }
            if(pane.find('#settings-capabilities-configuration').is(':checked')) {
                app_capabilities.push('configurable');
            }
            app_capabilities = app_capabilities.join(',');

            if(name.replace(/\s/g, '') === '') {
                display_error("You must specify a project name");
                return;
            }


            pane.find('input, button, select').attr('disabled', 'disabled');

            var saved_settings = {
                'name': name,
                sdk_version: sdk_version
            };

            if(sdk_version == 1) {
                if(version_def_name.replace(/\s/g, '') === '') {
                    display_error("You must specify a versionDefName (how about APP_RESOURCES?)");
                    return;
                }
                saved_settings['version_def_name'] = version_def_name;
            } else {
                if(short_name.replace(/\s/g, '') == '') {
                    display_error("You must specify a short name.");
                    return;
                }
                if(long_name.replace(/\s/g, '') == '') {
                    display_error("You must specify a long name.");
                    return;
                }
                if(company_name.replace(/\s/g, '') == '') {
                    display_error("You must specify a company name.");
                    return;
                }
                if(version_code.replace(/\s/g, '') == '' || version_code.replace(/\d/g,'') != '') {
                    display_error("You must specify a positive integer version code.");
                    return;
                }
                if(version_label.replace(/\s/g, '') == '') {
                    display_error("You must specify a version label.");
                    return;
                }
                if(!app_uuid.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)) {
                    display_error("You must specify a valid UUID (of the form 00000000-0000-0000-0000-000000000000)");
                    return;
                }

                pane.find(".appkey").each(function() {
                    app_keys[$(this).find('.appkey-name').val()] = $(this).find('.appkey-id').val();
                });

                saved_settings['app_short_name'] = short_name;
                saved_settings['app_long_name'] = long_name;
                saved_settings['app_company_name'] = company_name;
                saved_settings['app_version_code'] = version_code;
                saved_settings['app_version_label'] = version_label;
                saved_settings['app_uuid'] = app_uuid;
                saved_settings['app_capabilities'] = app_capabilities;
                saved_settings['app_is_watchface'] = app_is_watchface;
                saved_settings['app_keys'] = JSON.stringify(app_keys);
                saved_settings['app_jshint'] = app_jshint;
                saved_settings['menu_icon'] = menu_icon;
            }

            $.post('/ide/project/' + PROJECT_ID + '/save_settings', saved_settings, function(data) {
                pane.find('input, button, select').removeAttr('disabled');
                pane.find('.alert').removeClass("alert-success alert-error").addClass("hide");
                if(data.success) {
                    CloudPebble.ProjectInfo.name = name;
                    CloudPebble.ProjectInfo.sdk_version = sdk_version
                    if(sdk_version == 1) {
                        CloudPebble.ProjectInfo.version_def_name = version_def_name;
                    } else {
                        CloudPebble.ProjectInfo.app_uuid = app_uuid
                        CloudPebble.ProjectInfo.app_company_name = company_name
                        CloudPebble.ProjectInfo.app_short_name = short_name
                        CloudPebble.ProjectInfo.app_long_name = long_name
                        CloudPebble.ProjectInfo.app_version_code = version_code
                        CloudPebble.ProjectInfo.app_version_label = version_label
                        CloudPebble.ProjectInfo.app_is_watchface = app_is_watchface
                        CloudPebble.ProjectInfo.app_capabilities = app_capabilities
                        CloudPebble.ProjectInfo.app_jshint = app_jshint
                    }
                    $('.project-name').text(name);
                    window.document.title = "CloudPebble – " + name;
                    display_success("Settings saved.");
                    CloudPebble.Editor.Autocomplete.Init();
                } else {
                    display_error("Error: " + data.error);
                }
            });

            ga('send', 'event', 'project', 'save settings');
        });

        pane.find('#project-delete').click(function() {
            CloudPebble.Prompts.Confirm("Delete Project", "Are you sure you want to delete this project? THIS CANNOT BE UNDONE.", function() {
                $.post('/ide/project/' + PROJECT_ID + '/delete', {confirm: true}, function(data) {
                    if(data.success) {
                        window.location.href = "/ide/";
                    } else {
                        display_error("Error: " + data.error);
                    }
                });
                ga('send', 'event', 'project', 'delete');
            });
        });

        pane.find('#project-export-zip').click(function() {
            var dialog = $('#export-progress');
            dialog
                .modal('show')
                .find('p')
                .removeClass("text-error")
                .text("We're just getting that packed up for you…")
                .siblings('.progress')
                .addClass('progress-striped')
                .removeClass('progress-success progress-danger progress-warning');
            $.post('/ide/project/' + PROJECT_ID + '/export', {}, function(data) {
                if(!data.success) {
                    dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
                    dialog.find('p').addClass('text-error').text("Something went wrong! This is odd; there's no failure mode here.");
                    return;
                }
                var task_id = data.task_id;
                var check_update = function() {
                    $.getJSON('/ide/task/' + task_id, function(data) {
                        if(!data.success) {
                            dialog.find('.progress').addClass('progress-warning');
                            dialog.find('p').text("This isn't going too well…");
                            setTimeout(check_update, 1000);
                        } else {
                            if(data.state.status == 'SUCCESS') {
                                dialog.find('.progress').removeClass('progress-striped').addClass('progress-success');
                                dialog.find('p').html("<a href='" + data.state.result + "' class='btn btn-primary'>Download</a>");
                            } else if(data.state.status == 'FAILURE') {
                                dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
                                dialog.find('p').addClass('text-error').text("Failed. " + data.state.result);
                            } else {
                                setTimeout(check_update, 1000);
                            }
                        }
                    });
                };
                setTimeout(check_update, 1000);
            });

            ga('send', 'event', 'project', 'export', 'zip');
        });

        var appkey_name = pane.find('#add-appkey-name');
        var appkey_id = pane.find('#add-appkey-id');

        pane.find('#add-appkey').click(function() {
            var name = appkey_name.val();
            var id = appkey_id.val();

            appkey_name.val('');

            var new_appkey = $('<tr class="appkey">' +
                '<td><input class="appkey-name" type="text" /></td>' +
                '<td><input class="appkey-id" type="number" /></td>' +
                '<td><button class="btn remove-appkey"><i class="icon-minus"></i></button></td>' +
                '</tr>');

            new_appkey.find('.remove-appkey').click(function() {
                new_appkey.remove();
            });

            new_appkey.find('.appkey-name').val(name);
            new_appkey.find('.appkey-id').val(id);

            pane.find('#appkeys').append(new_appkey);
        });

        pane.find('.remove-appkey').click(function() {
            $(this).closest('.appkey').remove();
        });

        pane.find('#settings-sdk-version').click(function() {
            var val = $(this).val();
            if(val == '1') {
                $('.v2-only').hide();
                $('.v1-only').show();
            } else {
                $('.v1-only').hide();
                $('.v2-only').show();
            }
        });

        CloudPebble.Sidebar.SetActivePane(pane, 'settings');
    };

    var add_resource = function(resource) {
        var thing = settings_template.find('#settings-menu-image');
        var option = $('<option>').attr('value', resource.id).text(resource.file_name);
        thing.append(option);
        if(resource.id == CloudPebble.ProjectInfo.menu_icon) {
            thing.val(resource.id);
        }
    };

    var remove_resource = function(resource) {
        var thing = settings_template.find('#settings-menu-image');
        thing.find('[value=' + resource.id + ']').remove();
        if(resource.id == CloudPebble.ProjectInfo.menu_icon) {
            thing.val('');
            CloudPebble.ProjectInfo.menu_icon = null;
        }
    };

    return {
        Show: function() {
            show_settings_pane();
        },
        Init: function() {
            settings_template = $('#settings-pane-template').remove().removeClass('hide');
        },
        AddResource: function(resource) {
            add_resource(resource);
        },
        RemoveResource: function(resource) {
            remove_resource(resource);
        }
    };
})();
