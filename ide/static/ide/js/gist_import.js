$(function() {
    jquery_csrf_setup();

    var import_button = $('#import-btn');
    import_button.click(function() {
        import_button.prop('disabled', true);
        run_import(GIST_ID).then(function(location) {
            window.location.href = location;
        }).catch(function(error) {
            alert(interpolate(gettext("Import failed: %s"), [error.message]));
        }).finally(function() {
            import_button.prop('disabled', false);
        });
    });

    var run_import = function(gist_id) {
        return Ajax.Post('/ide/import/gist', {gist_id: gist_id}).then(function(data) {
            return handle_import_progress(data.task_id);
        });
    };

    var handle_import_progress = function(task_id) {
        var check = function() {
            return Ajax.Get('/ide/task/' + task_id).then(function(data) {
                if(data.state.status == 'SUCCESS') {
                    return '/ide/project/' + data.state.result;
                } else if(data.state.status == 'FAILURE') {
                    throw new Error(data.state.result);
                } else {
                    return Promise.delay(500).then(check);
                }
            });
        };
        return Promise.delay(500).then(check);
    };
});
