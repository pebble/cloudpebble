var CloudPebble = {};

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
    CloudPebble.Compile.Init();
    CloudPebble.Editor.Init();
    CloudPebble.Resources.Init();
    CloudPebble.Sidebar.Init();
    CloudPebble.Settings.Init();

    // Load in project data.
    $.getJSON('/ide/project/' + PROJECT_ID + '/info', function(data) {
        CloudPebble.ProgressBar.Hide();
        if(!data.success) {
            alert("Something went wrong:\n" + data.error);
            return;
        }
        CloudPebble.ProjectInfo = data;

        // Add source files.
        $.each(data.source_files, function(index, value) {
            CloudPebble.Editor.Add(value);
        });

        $.each(data.resources, function(index, value) {
            CloudPebble.Resources.Add(value);
        });

        CloudPebble.Editor.Autocomplete.Init();
    });

    window.addEventListener('beforeunload', function(e) {
        var u = CloudPebble.Editor.GetUnsavedFiles();
        if(u > 0) {
            var confirm = "You have " + u + " unsaved source file" + (u==1?'':'s') + ".\nIf you leave the page, you will lose them.";
            (e || window.event).returnValue = confirm;
            return confirm;
        }
    });
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
    }
};

CloudPebble.Utils = {
    FormatDatetime: function(str) {
        var date = new Date(Date.parse(str.replace(' ', 'T')));
        return date.toLocaleString();
    },
    FormatInterval: function(s1, s2) {
        var t = Math.round(Math.abs(Date.parse(s2.replace(' ','T')) - Date.parse(s1.replace(' ','T'))) / 1000);
        return t.toFixed(0) + " second" + (t == 1 ? '' : 's');
    }
};
