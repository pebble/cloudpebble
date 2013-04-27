CloudPebble.Compile = (function() {
    var COMPILE_SUCCESS_STATES = {
        1: {english: "Pending", cls: "info", label: 'info'},
        2: {english: "Failed", cls: "error", label: 'important'},
        3: {english: "Succeeded", cls: "success", label: 'success'}
    }

    var build_history_row = function(build) {
        var tr = $('<tr>');
        tr.append($('<td>' + (build.id === null ? '?' : build.id) + '</td>'));
        tr.append($('<td>' + CloudPebble.Utils.FormatDatetime(build.started) + '</td>'));
        tr.append($('<td>' + COMPILE_SUCCESS_STATES[build.state].english + '</td>'));
        tr.append($('<td>' + (build.state == 3 ? ('<a href="'+build.pbw+'">pbw</a>') : ' ') + '</td>'));
        tr.append($('<td>' + (build.state > 1 ? ('<a href="'+build.log+'">build log</a>') : ' ' )+ '</td>'));
        tr.addClass(COMPILE_SUCCESS_STATES[build.state].cls);
        return tr
    }

    var update_build_history = function(pane) {
        $.getJSON('/ide/project/' + PROJECT_ID + '/build/history', function(data) {
            CloudPebble.ProgressBar.Hide();
            pane.removeClass('hide');
            if(!data.success) {
                alert("Something went wrong:\n" + data.error); // This should be prettier.
                CloudPebble.Sidebar.DestroyActive();
                return;
            }
            if(data.builds.length > 0) {
                update_last_build(pane, data.builds[0]);
            } else {
                update_last_build(pane, null);
            }
            pane.find('#run-build-table').html('')
            $.each(data.builds, function(index, value) {
                pane.find('#run-build-table').append(build_history_row(value));
            });
            if(data.builds.length > 0 && data.builds[0].state == 1) {
                setTimeout(function() { update_build_history(pane) }, 1000);
            }
        });
    }

    var show_compile_pane = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("compile")) {
            return;
        }
        var pane = $('#compilation-pane-template').clone();
        // Get build history
        update_build_history(pane);
        pane.find('#compilation-run-build-button').click(function() {
            var temp_build = {started: (new Date()).toISOString(), finished: null, state: 1, uuid: null, id: null};
            update_last_build(pane, temp_build);
            pane.find('#run-build-table').prepend(build_history_row(temp_build));
            $.post('/ide/project/' + PROJECT_ID + '/build/run', {}, function() {
                update_build_history(pane);
            })
        });
        CloudPebble.Sidebar.SetActivePane(pane, 'compile');
        CloudPebble.ProgressBar.Show();
    }

    var update_last_build = function(pane, build) {
        if(build == null) {
            pane.find('#last-compilation').addClass('hide');
            pane.find('#compilation-run-build-button').removeAttr('disabled');
        } else {
            pane.find('#last-compilation').removeClass('hide');
            pane.find('#last-compilation-started').text(CloudPebble.Utils.FormatDatetime(build.started));
            if(build.state > 1) {
                pane.find('#last-compilation-time').removeClass('hide').find('span').text(CloudPebble.Utils.FormatInterval(build.started, build.finished));
                pane.find('#last-compilation-log').removeClass('hide').find('a').attr('href', build.log);
                pane.find('#compilation-run-build-button').removeAttr('disabled');
                if(build.state == 3) {
                    pane.find('#last-compilation-pbw').removeClass('hide').find('a:first').attr('href', build.pbw);
                    var url = build.pbw;
                    pane.find('#last-compilation-qr-code').removeClass('hide').find('img').attr('src', '/qr/?v=' + url);
                    $('#pbw-shortlink > a').attr('href', '#').text("get short link").unbind('click').click(function() {
                        $('#pbw-shortlink > a').text("generating…").unbind('click');
                        $.post("/ide/shortlink", {url: url}, function(data) {
                            if(data.success) {
                                $('#pbw-shortlink > a').attr('href', data.url).text(data.url.replace(/^https?:\/\//,''));
                            } else {
                                $('#pbw-shortlink > a').text("no shortlink");
                            }
                        });
                    });
                }
            } else {
                pane.find('#last-compilation-time').addClass('hide');
                pane.find('#last-compilation-log').addClass('hide');
                pane.find('#compilation-run-build-button').attr('disabled', 'disabled');
            }
            if(build.state != 3) {
                pane.find('#last-compilation-pbw').addClass('hide');
                pane.find('#last-compilation-qr-code').addClass('hide');
            }
            pane.find('#last-compilation-status').removeClass('label-success label-error label-info').addClass('label-' + COMPILE_SUCCESS_STATES[build.state].label).text(COMPILE_SUCCESS_STATES[build.state].english)
        }
    }

    return {
        Show: function() {
            show_compile_pane();
        },
        Init: function() {
            // Nothing.
        }
    }
})();
