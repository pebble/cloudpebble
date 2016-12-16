CloudPebble.Settings = (function() {
    var settings_template = null;
    var shared_pane = null;

    function app_uses_array_appkeys() {
        return _.isArray(CloudPebble.ProjectInfo.app_keys);
    }

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
        if (CloudPebble.ProjectInfo.type == 'package') {
            pane.find('.not-package').hide();
        }
        if(!(CloudPebble.ProjectProperties.supports_aplite)) {
            pane.find('.supports-aplite').hide();
        }
        if(!(CloudPebble.ProjectProperties.supports_message_keys)) {
            pane.find('.supports-message-keys').hide();
        }
        if(!(CloudPebble.ProjectProperties.supports_jslint)) {
            pane.find('.supports-jslint').hide();
        }
        if(CloudPebble.ProjectInfo.sdk_version != '3') {
            pane.find('.sdk3-only').hide();
        }

        var display_error = function(message) {
            pane.find('.alert').addClass('alert-error').removeClass('hide').text(message);
            pane.find('input, button, select').removeAttr('disabled');
        };

        pane.find('#settings-name').val(CloudPebble.ProjectInfo.name);
        pane.find('form').submit(function(e) {e.preventDefault();});

        var save = function() {

            var name = pane.find('#settings-name').val();
            var sdk_version = pane.find('#settings-sdk-version').val();
            var short_name = pane.find('#settings-short-name').val();
            var long_name = pane.find('#settings-long-name').val();
            var company_name = pane.find('#settings-company-name').val();
            var version_label = pane.find('#settings-version-label').val();
            var app_uuid = pane.find('#settings-uuid').val();
            var app_is_watchface = pane.find('#settings-app-is-watchface').val();
            var app_key_array_style = pane.find('#settings-message-key-kind').val() == "1";
            var app_jshint = pane.find('#settings-app-jshint').prop("checked") ? 1 : 0;
            var app_modern_multi_js = pane.find('#settings-modern-multi-js').val();
            var menu_icon = pane.find('#settings-menu-image').val();
            var build_aplite = pane.find('#settings-build-aplite:visible').prop('checked');
            var build_basalt = pane.find('#settings-build-basalt:visible').prop('checked');
            var build_chalk = pane.find('#settings-build-chalk:visible').prop('checked');
            var build_diorite = pane.find('#settings-build-diorite:visible').prop('checked');
            var build_emery = pane.find('#settings-build-emery:visible').prop('checked');

            var app_keys = (app_key_array_style ? [] : {});
            var app_key_names = [];
            
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
            if(pane.find('#settings-capabilities-health').is(':checked')) {
                app_capabilities.push('health');
            }
            app_capabilities = app_capabilities.join(',');

            if(name.replace(/\s/g, '') === '') {
                throw new Error(gettext("You must specify a project name"));
            }

            var saved_settings = {
                'name': name
            };

            if(short_name.replace(/\s/g, '') == '') {
                throw new Error(gettext("You must specify a short name."));
            }

            if (CloudPebble.ProjectProperties.is_runnable) {
                if(long_name.replace(/\s/g, '') == '') {
                    throw new Error(gettext("You must specify a poop name."));
                }
            }

            if(company_name.replace(/\s/g, '') == '') {
                throw new Error(gettext("You must specify a company name."));
            }
            // This is not an appropriate use of a regex, but we have to have it for the HTML5 pattern attribute anyway,
            // so we may as well reuse the effort here.
            // It validates that the format matches x[.y] with x, y in [0, 255].
            if(CloudPebble.ProjectInfo.type != 'package' && !version_label.match(REGEXES.sdk_version)) {
                throw new Error(gettext("You must specify a valid version number."));
            }
            if(CloudPebble.ProjectInfo.type == 'package' && !version_label.match(REGEXES.semver)) {
                throw new Error(gettext("You must specify a valid version semver."));
            }
            if(!app_uuid.match(REGEXES.uuid)) {
                throw new Error(gettext("You must specify a valid UUID (of the form 00000000-0000-0000-0000-000000000000)"));
            }


            if(sdk_version == '3' && !(build_aplite || build_basalt || build_chalk || build_diorite || build_emery)) {
                throw new Error(gettext("You must build your app for at least one platform."));
            }

            var target_platforms = [];
            if(build_aplite) {
                target_platforms.push('aplite');
            }
            if(build_basalt) {
                target_platforms.push('basalt');
            }
            if(build_chalk) {
                target_platforms.push('chalk');
            }
            if(build_diorite) {
                target_platforms.push('diorite');
            }
            if(build_emery) {
                target_platforms.push('emery');
            }
            var app_platforms = target_platforms.join(',');
            
            var appkey_data = appkey_table.getValues();
            _.each(appkey_data, function(tuple) {
                var name = tuple[0];
                var id = parseInt(tuple[1], 10);

                if(name.replace(/\s/g, '') == '') {
                    // Skip blank keys.
                    return;
                }
                if (app_key_array_style) {
                    if (!name.match(/^[a-zA-Z_][_a-zA-Z\d]*$/)) {
                        throw new Error("Message key names must be valid C identifiers");
                    }
                    if (id < 1) {
                        throw new Error("Message key names must have lengths greater than 0.");
                    }
                    if (id > 1) {
                        name+="["+id+"]";
                    }
                    app_keys.push(name);
                }
                else {
                    app_keys[name] = id;
                }
                app_key_names.push(name);
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
            saved_settings['app_modern_multi_js'] = app_modern_multi_js;

            return Ajax.Post('/ide/project/' + PROJECT_ID + '/save_settings', saved_settings).then(function() {
                pane.find('.alert').removeClass("alert-success alert-error").addClass("hide");

                CloudPebble.ProjectInfo.name = name;
                CloudPebble.ProjectInfo.app_uuid = app_uuid;
                CloudPebble.ProjectInfo.app_company_name = company_name;
                CloudPebble.ProjectInfo.app_short_name = short_name;
                CloudPebble.ProjectInfo.app_long_name = long_name;
                CloudPebble.ProjectInfo.app_version_label = version_label;
                CloudPebble.ProjectInfo.app_is_watchface = app_is_watchface;
                CloudPebble.ProjectInfo.app_keys = app_keys;
                CloudPebble.ProjectInfo.app_is_hidden = app_is_hidden;
                CloudPebble.ProjectInfo.app_is_shown_on_communication = app_is_shown_on_communication;
                CloudPebble.ProjectInfo.app_capabilities = app_capabilities;
                CloudPebble.ProjectInfo.app_jshint = app_jshint;
                CloudPebble.ProjectInfo.app_platforms = app_platforms;
                CloudPebble.ProjectInfo.sdk_version = sdk_version;
                CloudPebble.ProjectInfo.app_modern_multi_js = app_modern_multi_js;

                pane.find('#settings-sdk-version option[value=2]').prop('disabled', CloudPebble.ProjectInfo.sdk_version != '2');
                $('.project-name').text(name);
                window.document.title = "CloudPebble – " + name;

                if (CloudPebble.Ready) {
                    CloudPebble.YCM.updateAppkeys(app_key_names);
                }
                return null;
            }).catch(function(e) {
                throw new Error(interpolate("Failed to save project settings. (%s) %s", [e.status, e.message]));
            });
        };

        var live_form = make_live_settings_form({
            save_function: save,
            error_function: display_error,
            label_selector: '.control-group label, button.kv-remove',
            group_selector: '.control-group, tr',
            form: pane.find('form')
        });

        pane.find('#project-delete').click(function() {
            CloudPebble.Prompts.Confirm(gettext("Delete Project"), gettext("Are you sure you want to delete this project? THIS CANNOT BE UNDONE."), function() {
                Ajax.Post('/ide/project/' + PROJECT_ID + '/delete', {confirm: true}).then(function() {
                    window.location.href = "/ide/";
                }).catch(function(error) {
                    display_error(interpolate(gettext("Error: %s"), [error]));
                });
                ga('send', 'event', 'project', 'delete');
            });
        });

        function export_project() {
            var dialog = $('#export-progress');
            dialog
                .modal('show')
                .find('.progress')
                .addClass('progress-striped')
                .removeClass('progress-success progress-danger progress-warning');
            function show_warning() {
                dialog.find('.progress').addClass('progress-warning');
            }
            return Ajax.Post('/ide/project/' + PROJECT_ID + '/export', {}).then(function(data) {
                return Ajax.PollTask(data.task_id, {on_bad_request: show_warning});
            }).then(function(result) {
                dialog.find('.progress').removeClass('progress-striped').addClass('progress-success');
                dialog.find('.download-btn').attr('href', result).show();
            }).catch(function() {
                dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
            }).finally(function() {
                ga('send', 'event', 'project', 'export', 'zip');
            });
        }

        pane.find('#project-export-zip').click(export_project);


        var appkey_table_elm = pane.find('#settings-app-keys');
        var appkey_table = new CloudPebble.KVTable(appkey_table_elm, {
            key_name: 'Key Name',
            value_name: 'Key ID',
            value_type: 'number',
            default_value: 1,
            tbody_id: 'appkeys',
            data: CloudPebble.ProjectInfo.parsed_app_keys
        }).on('rowDeleted', function() {
            live_form.save(appkey_table_elm.find('tr.kv-row:last-child'));
        }).on('rowAdded', function(info) {
            live_form.addElement($(info.element));
        }).init();

        function configure_appkey_table(is_array_kind) {
            var id_title, help_text, default_value;
            if (is_array_kind) {
                id_title = gettext("Key Array Length");
                help_text = gettext("A list of appMessage keys to assign for the app. Arrays with length greater than one will have a block of contiguous keys reserved after the key assigned to the given name.");
                default_value = '1';
            }
            else {
                id_title = gettext("Key ID");
                help_text = gettext("A mapping from strings to integers used by PebbleKit JS.");
                default_value = '0';
            }
            appkey_table.setValueName(id_title);
            appkey_table.setDefaultValue(default_value);
            appkey_table_elm.next('.help-block').text(help_text);
        }

        function reset_appkey_table_values(to_array_kind) {
            var was_array_kind = app_uses_array_appkeys();
            if (to_array_kind == was_array_kind) return;
            appkey_table.mapValues(to_array_kind ? 1 : function(k, v, i) {
                return !!k.trim() ? i : 0;
            });
        }

        pane.find('#settings-message-key-kind').change(function() {
            var is_array_kind = $(this).val() == '1';
            reset_appkey_table_values(is_array_kind);
            configure_appkey_table(is_array_kind);
        });

        var sdk_version_change_confirmed = false;
        pane.find('#settings-sdk-version').change(function(e) {
            // When switching away from SDK 2, show a confirmation prompt to indicate that the change is irreversible.
            var sdk = $(this).val();
            if (CloudPebble.ProjectInfo.sdk_version == '2' && sdk != '2' && !sdk_version_change_confirmed) {
                e.stopPropagation();
                $(this).val('2');
                var message = gettext("Are you sure you want to upgrade this project to SDK 4? THIS CANNOT BE UNDONE.");
                CloudPebble.Prompts.Confirm(gettext("UPGRADE SDK"), message, function() {
                    sdk_version_change_confirmed = true;
                    if(sdk == '3') {
                        pane.find('.sdk3-only').show();
                    } else {
                        pane.find('.sdk3-only').hide();
                    }
                    $(this).val(sdk).change();
                }.bind(this));
            }
        });

        pane.find('#settings-modern-multi-js').change(function(e) {
            if($(this).val() != '1') {
                return;
            }
            var js_files = _.chain(CloudPebble.Editor.GetAllFiles())
                .filter(function(x) { return x.name.endsWith('.js'); })
                .value();
            if(js_files.length == 0) {
                return;
            }
            if(_.contains(_.pluck(js_files, 'name'), 'app.js')) {
                return;
            }
            // Don't save anything until we've done this.
            var did_rename = false;
            e.stopPropagation();
            $('#settings-js-migration-prompt')
                .modal()
                .one('hide', function() {
                    if (!did_rename) {
                        $('#settings-modern-multi-js').val('0');
                    }
                })
                .find('select')
                .empty()
                .append(_.map(js_files,
                    function(x) {
                        return $('<option>').data('file', x).text(x.name)[0];
                    }
                ));
        });

        $('#settings-js-migration-rename-button').click(function() {
            var file = $('#settings-js-new-entry-point').find(':selected').data('file');
            CloudPebble.Editor.RenameFile(file, 'app.js').then(function() {
                $('#settings-js-migration-prompt').modal('hide');
                $('#settings-modern-multi-js').val('1').change();
            }).catch(function(error) {
                alert(error);
            });
        });

        pane.find('#uuid-generate').click(function() {
            var uuid_field = settings_template.find('#settings-uuid');
            uuid_field.val(_.UUID.v4());
            uuid_field.trigger("change");
        });

        live_form.init();

        CloudPebble.Sidebar.SetActivePane(pane, {id: 'settings'});

        configure_appkey_table(app_uses_array_appkeys());
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
            commands[gettext("Add New Resource")] = CloudPebble.Resources.Create;
            commands[gettext("Compilation")] = CloudPebble.Compile.Show;
            commands[gettext("Settings")] = CloudPebble.Settings.Show;
            commands["GitHub"] = CloudPebble.GitHub.Show;
            commands[gettext("Timeline")] = CloudPebble.Timeline.show;
            commands[gettext("Add New Source File")] = CloudPebble.Editor.Create;
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
