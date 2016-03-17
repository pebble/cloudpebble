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
        Ajax.Post('/ide/transition/export', {}).then(function(data) {
            var task_id = data.task_id;
            var check_update = function() {
                return Ajax.Get('/ide/task/' + task_id).then(function(data) {
                    if(data.state.status == 'SUCCESS') {
                        dialog.find('.progress').removeClass('progress-striped').addClass('progress-success');
                        dialog.find('p').html("<a href='" + data.state.result + "' class='btn btn-primary'>Download</a>");
                    } else if(data.state.status == 'FAILURE') {
                        dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
                        dialog.find('p').addClass('text-error').text("Failed. " + data.state.result);
                    } else {
                        return Promise.delay(1000).then(check_update);
                    }
                }).catch(function() {
                    dialog.find('.progress').addClass('progress-warning');
                    dialog.find('p').text("This isn't going too well…");
                    return Promise.delay(1000).then(check_update);
                });
            };

            return Promise.delay(1000).then(check_update);
        }).catch(function(error) {
            dialog.find('.progress').removeClass('progress-striped').addClass('progress-danger');
            dialog.find('p').addClass('text-error').text("Something went wrong! This is odd; there's no failure mode here.");
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
