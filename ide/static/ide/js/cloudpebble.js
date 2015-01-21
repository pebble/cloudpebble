var CloudPebble = {};
CloudPebble.Ready = false;

CloudPebble.ProgressBar = (function() {
    function hide() {
        $('#progress-pane').addClass('hide');
    }

    function show() {
        $('#progress-pane').removeClass('hide');
    }
    return {
        Show: function() {
            show();
        },
        Hide: function() {
            hide();
        }
    };
})();

CloudPebble.ProjectInfo = {};

CloudPebble.Init = function() {
    jquery_csrf_setup();

    // Load in project data.
    $.getJSON('/ide/project/' + PROJECT_ID + '/info', function(data) {
        if(!data.success) {
            alert("Something went wrong:\n" + data.error);
            return;
        }
        CloudPebble.ProjectInfo = data;

        CloudPebble.Compile.Init();
        CloudPebble.Editor.Init();
        CloudPebble.Resources.Init();
        CloudPebble.Sidebar.Init();
        CloudPebble.Settings.Init();
        CloudPebble.GitHub.Init();
        CloudPebble.Documentation.Init();

        CloudPebble.ProgressBar.Hide();

        // Add source files.
        $.each(data.source_files, function(index, value) {
            CloudPebble.Editor.Add(value);
        });

        $.each(data.resources, function(index, value) {
            CloudPebble.Resources.Add(value);
        });
        CloudPebble.Emulator.init();
        CloudPebble.YCM.initialise();
        CloudPebble.Sidebar.SetProjectType(data.type);
        CloudPebble.Ready = true;
    });

    window.addEventListener('beforeunload', function(e) {
        var u = CloudPebble.Editor.GetUnsavedFiles();
        if(u > 0) {
            var confirm = ngettext("You have one unsaved source file. If you leave this page, you will lose it.",
                "You have %s unsaved source files. If you leave this page, you will lose them.", u);
            confirm = interpolate(confirm, [u]);
            (e || window.event).returnValue = confirm;
            return confirm;
        }
    });
    ga('send', 'event', 'project', 'open');
    var dimensionValue = 'SOME_DIMENSION_VALUE';
    ga('set', 'dimension1', USER_ID); // User
    ga('set', 'dimension2', _.random(1, 2147000000)); // Random page load identifier-ish
    ga('set', 'dimension3', PROJECT_ID); // Project
};

CloudPebble.Prompts = {
    Prompt: function(title, prompt, placeholder, default_value, callback) {
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
    },
    Confirm: function(title, prompt, callback) {
        $('#modal-warning-prompt-title').text(title);
        $('#modal-warning-prompt-warning').text(prompt);
        $('#modal-warning-prompt').modal();
        $('#modal-warning-prompt-button').unbind('click').click(function() {
            $('#modal-warning-prompt').modal('hide');
            callback();
        });
    },
    Progress: {
        Show: function(title, text, hide_callback) {
            var modal = $('#generic-progress').modal('show');
            modal.find('.progress').removeClass('progress-danger').addClass('progress-striped');
            modal.find('h3').text(title);
            modal.find('p').text(text || '');
            if(hide_callback) {
                modal.on('hide', function() {
                    modal.off('hide');
                    hide_callback();
                });
            }
        },
        Fail: function() {
            var modal = $('#generic-progress').modal('show');
            modal.find('.progress').addClass('progress-danger').removeClass('progress-striped');
        },
        Update: function(text) {
           var modal = $('#generic-progress').modal('show');
           modal.find('p').text(text || '');
        },
        Hide: function() {
            var modal = $('#generic-progress');
            modal.off('hide');
            modal.modal('hide');
        }
    }
};

CloudPebble.Utils = {
    FormatDatetime: function(str) {
        var date = new Date(Date.parse(str.replace(' ', 'T')));
        var months = [
            pgettext('month name', 'January'),
            pgettext('month name', 'February'),
            pgettext('month name', 'March'),
            pgettext('month name', 'April'),
            pgettext('month name', 'May'),
            pgettext('month name', 'June'),
            pgettext('month name', 'July'),
            pgettext('month name', 'August'),
            pgettext('month name', 'September'),
            pgettext('month name', 'October'),
            pgettext('month name', 'November'),
            pgettext('month name', 'December')
        ];

        var minutes = String(date.getMinutes());
        while(minutes.length < 2) minutes = '0' + minutes;

        var hours = String(date.getHours());
        while(hours.length < 2) hours = '0' + hours;

        return date.getDate() + ' ' + months[date.getMonth()] +', \'' + (date.getFullYear() % 100) +
            ' – ' + hours + ":" + minutes;
    },
    FormatInterval: function(s1, s2) {
        var t = Math.round(Math.abs(Date.parse(s2.replace(' ','T')) - Date.parse(s1.replace(' ','T'))) / 1000);
        var n = t.toFixed(0);
        return interpolate(ngettext("%s second", "%s seconds", n), [n]);
    }
};
