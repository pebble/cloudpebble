$(function() {
    jquery_csrf_setup();

    var import_button = $('#import-btn');
    import_button.click(function() {
        import_button.attr('disabled', 'disabled');
        run_import(GIST_ID);
    });

    var run_import = function(gist_id) {
        $.post('/ide/import/gist', {gist_id: gist_id}, function(data) {
            if(data.success) {
                handle_import_progress(data.task_id);
            }
        });
    };

    var handle_import_progress = function(task_id) {
        var check = function() {
            $.getJSON('/ide/task/' + task_id, function(data) {
                if(data.state.status == 'SUCCESS') {
                    window.location.href = '/ide/project/' + data.state.result;
                } else if(data.state.status == 'FAILURE') {
                    alert(interpolate(gettext("Import failed: %s"), data.state.result));
                } else {
                    setTimeout(check, 500);
                }
            });
        };
        setTimeout(check, 500);
    };
});
