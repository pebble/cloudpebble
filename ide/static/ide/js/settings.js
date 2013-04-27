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
        }

        var display_success = function(message) {
            pane.find('.alert').addClass('alert-success').removeClass('hide').text(message);
        }
        
        pane.find('#settings-name').val(CloudPebble.ProjectInfo.name);
        pane.find('#settings-version-def-name').val(CloudPebble.ProjectInfo.version_def_name);
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
                    CloudPebble.ProjectInfo.name = name;
                    CloudPebble.ProjectInfo.version_def_name = version_def_name;
                    $('.project-name').text(name);
                    window.document.title = "CloudPebble – " + name;
                    display_success("Settings saved.");
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
                })
            });
        });

        CloudPebble.Sidebar.SetActivePane(pane, 'settings');
    }

    return {
        Show: function() {
            show_settings_pane();
        },
        Init: function() {
            settings_template = $('#settings-pane-template').remove().removeClass('hide');
        }
    }
})();