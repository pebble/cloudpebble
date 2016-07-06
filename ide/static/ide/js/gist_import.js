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
            return Ajax.PollTask(data.task_id, {milliseconds: 500});
        }).then(function(result) {
            return '/ide/project/' + result;
        });
    };
});
