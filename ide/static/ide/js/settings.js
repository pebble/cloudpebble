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
            pane.find('.alert').addClass('alert-error').removeClass('hide').text(message);
            pane.find('input, button, select').removeAttr('disabled');
        };

        pane.find('#settings-name').val(CloudPebble.ProjectInfo.name);
        pane.find('form').submit(function(e) {e.preventDefault();});

        var save = function() {
            var defer = $.Deferred();
            var name = pane.find('#settings-name').val();
            var sdk_version = pane.find('#settings-sdk-version').val();
            var short_name = pane.find('#settings-short-name').val();
            var long_name = pane.find('#settings-long-name').val();
            var company_name = pane.find('#settings-company-name').val();
            var version_label = pane.find('#settings-version-label').val();
            var app_uuid = pane.find('#settings-uuid').val();
            var app_is_watchface = pane.find('#settings-app-is-watchface').val();
            var app_keys = {};
            var app_jshint = pane.find('#settings-app-jshint').prop("checked") ? 1 : 0;
            var menu_icon = pane.find('#settings-menu-image').val();
            var build_aplite = pane.find('#settings-build-aplite').prop('checked');
            var build_basalt = pane.find('#settings-build-basalt').prop('checked');

            var app_is_hidden = 0;
            var app_is_shown_on_communication = 0;
            if(pane.find('#settings-app-visibility').val() == 'hidden') {
                var app_is_hidden = 1;
            }
            if(pane.find('#settings-app-visibility').val() == 'show_on_comms') {
                var app_is_shown_on_communication = 1;
            }


            var app_capabilities = [];
            if(pane.find('#settings-capabilities-location').is(':checked')) {
                app_capabilities.push('location');
            }
            if(pane.find('#settings-capabilities-configuration').is(':checked')) {
                app_capabilities.push('configurable');
            }
            app_capabilities = app_capabilities.join(',');

            if(name.replace(/\s/g, '') === '') {
                return defer.reject(gettext("You must specify a project name"));
            }

            var saved_settings = {
                'name': name
            };

            if(short_name.replace(/\s/g, '') == '') {
                return defer.reject(gettext("You must specify a short name."));
            }
            if(long_name.replace(/\s/g, '') == '') {
                return defer.reject(gettext("You must specify a long name."));
            }
            if(company_name.replace(/\s/g, '') == '') {
                return defer.reject(gettext("You must specify a company name."));
            }
            // This is not an appropriate use of a regex, but we have to have it for the HTML5 pattern attribute anyway,
            // so we may as well reuse the effort here.
            // It validates that the format matches x[.y] with x, y in [0, 255].
            if(!version_label.match(/^(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])(\.(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5]))?$/)) {
                return defer.reject(gettext("You must specify a valid version number."));
            }
            if(!app_uuid.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/)) {
                return defer.reject(gettext("You must specify a valid UUID (of the form 00000000-0000-0000-0000-000000000000)"));
            }


            if(sdk_version == '3') {
                if (!build_aplite && !build_basalt) {
                    return defer.reject(gettext("You must build your app for at least one platform."));
                }
            }

            var target_platforms = [];
            if(build_aplite) {
                target_platforms.push('aplite');
            }
            if(build_basalt) {
                target_platforms.push('basalt');
            }
            var app_platforms = target_platforms.join(',');

            pane.find(".appkey").each(function() {
                var name = $(this).find('.appkey-name').val();
                var id = $(this).find('.appkey-id').val();

                if(name.replace(/\s/g, '') == '') {
                    // Skip blank keys.
                    return;
                }

                app_keys[name] = parseInt(id);
            });

            saved_settings['sdk_version'] = sdk_version;
            saved_settings['app_short_name'] = short_name;
            saved_settings['app_long_name'] = long_name;
            saved_settings['app_company_name'] = company_name;
            saved_settings['app_version_label'] = version_label;
            saved_settings['app_uuid'] = app_uuid;
            saved_settings['app_capabilities'] = app_capabilities;
            saved_settings['app_is_watchface'] = app_is_watchface;
            saved_settings['app_is_hidden'] = app_is_hidden;
            saved_settings['app_is_shown_on_communication'] = app_is_shown_on_communication;
            saved_settings['app_keys'] = JSON.stringify(app_keys);
            saved_settings['app_jshint'] = app_jshint;
            saved_settings['menu_icon'] = menu_icon;
            saved_settings['app_platforms'] = app_platforms;

            $.post('/ide/project/' + PROJECT_ID + '/save_settings', saved_settings, function(data) {
                pane.find('.alert').removeClass("alert-success alert-error").addClass("hide");
                if(data.success) {
                    CloudPebble.ProjectInfo.name = name;
                    CloudPebble.ProjectInfo.app_uuid = app_uuid;
                    CloudPebble.ProjectInfo.app_company_name = company_name;
                    CloudPebble.ProjectInfo.app_short_name = short_name;
                    CloudPebble.ProjectInfo.app_long_name = long_name;
                    CloudPebble.ProjectInfo.app_version_label = version_label;
                    CloudPebble.ProjectInfo.app_is_watchface = app_is_watchface;
                    CloudPebble.ProjectInfo.app_is_hidden = app_is_hidden;
                    CloudPebble.ProjectInfo.app_is_shown_on_communication = app_is_shown_on_communication;
                    CloudPebble.ProjectInfo.app_capabilities = app_capabilities;
                    CloudPebble.ProjectInfo.app_jshint = app_jshint;
                    CloudPebble.ProjectInfo.app_platforms = app_platforms;
                    CloudPebble.ProjectInfo.sdk_version = sdk_version;
                    $('.project-name').text(name);
                    window.document.title = "CloudPebble – " + name;
                    defer.resolve();
                } else {
                    defer.reject(interpolate(gettext("Error: %s"), [error]));
                }
            }).fail(function(e) {
                defer.reject(interpolate("Failed to save project settings. (%s) %s", [e.status, e.statusText]));
            });

            ga('send', 'event', 'project', 'save settings');
            return defer.promise();
        };

        var live_form = make_live_settings_form({
            save_function: save,
            error_function: display_error,
            form: pane.find('form')
        });

        pane.find('#project-delete').click(function() {
            CloudPebble.Prompts.Confirm(gettext("Delete Project"), gettext("Are you sure you want to delete this project? THIS CANNOT BE UNDONE."), function() {
                $.post('/ide/project/' + PROJECT_ID + '/delete', {confirm: true}, function(data) {
                    if(data.success) {
                        window.location.href = "/ide/";
                    } else {
                        display_error(interpolate(gettext("Error: %s"), [data.error]));
                    }
                });
                ga('send', 'event', 'project', 'delete');
            });
        });

        pane.find('#project-export-zip').click(function() {
            var dialog = $('#export-progress');
            dialog
                .modal('show')
                .find('.progress')
                .addClass('progress-striped')
                .removeClass('progress-success progress-danger progress-warning');
            $.post('/ide/project/' + PROJECT_ID + '/export', {}, function(data) {
                if(!data.success) {
                    dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
                    return;
                }
                var task_id = data.task_id;
                var check_update = function() {
                    $.getJSON('/ide/task/' + task_id, function(data) {
                        if(!data.success) {
                            dialog.find('.progress').addClass('progress-warning');
                            setTimeout(check_update, 1000);
                        } else {
                            if(data.state.status == 'SUCCESS') {
                                dialog.find('.progress').removeClass('progress-striped').addClass('progress-success');
                                dialog.find('.download-btn').attr('href', data.state.result).show();
                            } else if(data.state.status == 'FAILURE') {
                                dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
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

        var add_appkey_field = function() {
            $(this).off('change', add_appkey_field);

            var entry = $(this).closest('.appkey');
            entry.find('.remove-appkey').removeClass('disabled').click(function() {
                entry.remove();
                live_form.save($('#settings-app-keys'));
            });

            var new_appkey = $('<tr class="appkey">' +
                '<td><input class="appkey-name" type="text" placeholder="' + gettext("New Entry") + '" /></td>' +
                '<td><input class="appkey-id" type="number" value="0" /></td>' +
                '<td><button class="btn remove-appkey disabled">–</button></td>' +
                '</tr>');

            new_appkey.find('.appkey-name').on('change', add_appkey_field);

            pane.find('#appkeys').append(new_appkey);

            live_form.addElement(new_appkey);
        };

        pane.find('.appkey:last').on('change', add_appkey_field);

        pane.find('.remove-appkey').not('.disabled').click(function() {
            $(this).closest('.appkey').remove();
            live_form.save($('#settings-app-keys'));
        });

        pane.find('#settings-sdk-version').change(function() {
            var sdk = $(this).val();
            if(sdk == '3') {
                pane.find('.sdk3-only').show();
            } else {
                pane.find('.sdk3-only').hide();
            }
        });

        pane.find('#uuid-generate').click(function() {
            var uuid_field = settings_template.find('#settings-uuid');
            uuid_field.val(_.UUID.v4());
            uuid_field.trigger("change");
        });

        live_form.init();

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
            var commands = {};
            commands[gettext('Settings')] = show_settings_pane;
            CloudPebble.FuzzyPrompt.AddCommands(commands);
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
