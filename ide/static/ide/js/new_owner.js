(function() {
    function handle_accept() {
        $('.btn').attr('disabled', 'disabled');
        $.post("/ide/transition/accept", function(data) {
            if(!data.success) {
                alert("Something went wrong:\n" + data.error);
            } else {
                window.location.reload();
            }
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
        $.post('/ide/transition/export', {}, function(data) {
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
                $('.btn').attr('disabled', 'disabled');
                $.post('/ide/transition/delete', {}, function(data) {
                    if(data.success) {
                        document.location = '/';
                    } else {
                        alert("Account deletion failed.");
                    }
                });
            }
        );
    }

    jquery_csrf_setup();

    $('#btn-accept').click(handle_accept);
    $('#btn-export').click(handle_export);
    $('#btn-delete').click(handle_delete);
})();
