CloudPebble.Settings = (function() {
    var settings_template = null;

    var show_settings_pane = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("settings")) {
            return;
        }
        var pane = settings_template.clone(); // This clone is basically unncessary, since only one such pane can ever exist.
        var display_error = function(message) {
            pane.find('.alert').addClass('alert-error').removeClass('hide').text(message);
        };

        var display_success = function(message) {
            pane.find('.alert').addClass('alert-success').removeClass('hide').text(message);
        };

        pane.find('#settings-name').val(CloudPebble.ProjectInfo.name);
        pane.find('#settings-version-def-name').val(CloudPebble.ProjectInfo.version_def_name);
        pane.find('form').submit(function(e) {e.preventDefault();});
        pane.find('#project-save').click(function() {
            var name = pane.find('#settings-name').val();
            var version_def_name = pane.find('#settings-version-def-name').val();
            var optimisation = pane.find('#settings-optimisation').val();

            if(name.replace(/\s/g, '') === '') {
                display_error("You must specify a project name");
                return;
            }

            if(version_def_name.replace(/\s/g, '') === '') {
                display_error("You must specify a versionDefName (how about APP_RESOURCES?)");
                return;
            }

            pane.find('input, button, select').attr('disabled', 'disabled');

            $.post('/ide/project/' + PROJECT_ID + '/save_settings', {
                'name': name,
                'version_def_name': version_def_name,
                'optimisation': optimisation
            }, function(data) {
                pane.find('input, button, select').removeAttr('disabled');
                pane.find('.alert').removeClass("alert-success alert-error").addClass("hide");
                if(data.success) {
                    CloudPebble.ProjectInfo.name = name;
                    CloudPebble.ProjectInfo.version_def_name = version_def_name;
                    CloudPebble.ProjectInfo.optimisation = optimisation;
                    CloudPebble.Compile.SetOptimisation(optimisation);
                    $('.project-name').text(name);
                    window.document.title = "CloudPebble – " + name;
                    display_success("Settings saved.");
                    CloudPebble.Editor.Autocomplete.Init();
                } else {
                    display_error("Error: " + data.error);
                }
            });
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
        });

        CloudPebble.Sidebar.SetActivePane(pane, 'settings');
    };

    return {
        Show: function() {
            show_settings_pane();
        },
        Init: function() {
            settings_template = $('#settings-pane-template').remove().removeClass('hide');
        }
    };
})();
