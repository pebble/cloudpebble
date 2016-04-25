(function() {
    function handle_accept() {
        $('.btn').attr('disabled', 'disabled');
        Ajax.Post("/ide/transition/accept").then(function() {
            window.location.reload();
        }).catch(function(error) {
            alert("Something went wrong:\n" + error);
        });
    }

    function handle_export() {
        var dialog = $('#export-progress');
        dialog
            .modal('show')
            .find('p')
            .removeClass("text-error")
            .text("We're just getting that packed up for you…")
            .siblings('.progress')
            .addClass('progress-striped')
            .removeClass('progress-success progress-danger progress-warning');
        function show_warning() {
            dialog.find('.progress').addClass('progress-warning');
            dialog.find('p').text("This isn't going too well…");
        }
        Ajax.Post('/ide/transition/export', {}).then(function(data) {
            return CloudPebble.PollTask(data.task_id, {on_bad_request: show_warning});
        }).then(function(result) {
            dialog.find('.progress').removeClass('progress-striped').addClass('progress-success');
            dialog.find('p').html("<a href='" + result + "' class='btn btn-primary'>Download</a>");
        }).catch(function(error) {
            dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
            dialog.find('p').addClass('text-error').text("Failed. " + error.message);
        });
    }

    function confirm(title, prompt, callback) {
        $('#modal-warning-prompt-title').text(title);
        $('#modal-warning-prompt-warning').html(prompt);
        $('#modal-warning-prompt').modal();
        $('#modal-warning-prompt-button').unbind('click').click(function() {
            $('#modal-warning-prompt').modal('hide');
            callback();
        });
    }

    function handle_delete() {
        confirm(
            "Account deletion",
            "Are you certain you want to delete your account? This <em>cannot be undone</em>." +
                " If you have exported your projects, check that they are intact!",
            function() {
                $('.btn').prop('disabled', true);
                Ajax.Post('/ide/transition/delete', {}).then(function() {
                    document.location = '/';
                }).catch(function() {
                    alert("Account deletion failed.");
                    $('.btn').prop('disabled', false);
                });
            }
        );
    }

    jquery_csrf_setup();

    $('#btn-accept').click(handle_accept);
    $('#btn-export').click(handle_export);
    $('#btn-delete').click(handle_delete);
})();
