CloudPebble.Compile = (function() {
    var COMPILE_SUCCESS_STATES = {
        1: {english: "Pending", cls: "info", label: 'info'},
        2: {english: "Failed", cls: "error", label: 'important'},
        3: {english: "Succeeded", cls: "success", label: 'success'}
    };

    var build_history_row = function(build) {
        var tr = $('<tr>');
        tr.append($('<td>' + (build.id === null ? '?' : build.id) + '</td>'));
        tr.append($('<td>' + CloudPebble.Utils.FormatDatetime(build.started) + '</td>'));
        tr.append($('<td>' + COMPILE_SUCCESS_STATES[build.state].english + '</td>'));
        tr.append($('<td>' + (build.size.total !== null ? Math.round(build.size.total / 1024) + ' KiB' : '') + '</td>'));
        tr.append($('<td>' + (build.state == 3 ? ('<a href="'+build.pbw+'">pbw</a>') : ' ') + '</td>'));
        // Build log thingy.
        var td = $('<td>');
        if(build.state > 1) {
            var a = $('<a href="'+build.log+'">build log</a>').click(function(e) {
                if(e.ctrlKey || e.metaKey) {
                    ga('send', 'event', 'build log', 'show', 'external');
                    return true;
                }
                e.preventDefault();
                show_build_log(build.id);
                ga('send', 'event', 'build log', 'show', 'in-app');
            });
            td.append(a);
        }
        tr.append(td);
        tr.addClass(COMPILE_SUCCESS_STATES[build.state].cls);
        return tr;
    };

    var show_build_log = function(build) {
        $.getJSON('/ide/project/' + PROJECT_ID + '/build/' + build + '/log', function(data) {
            if(!data.success) {
                alert("Something went wrong:\n\n" + data.error);
                return;
            }
            CloudPebble.Sidebar.SuspendActive();
            // Sanitise the HTML.
            var log = data.log.replace('&', '&amp;').replace('<', '&lt;');
            // Now do clever things.
            log = log.replace("\nBuild failed\n", '\n<span class="log-error">Build failed</span>\n');
            log = log.replace(/(.+\berror:.+)/g, '<span class="log-error">$1</span>');
            log = log.replace(/(.+\bnote:.+)/g, '<span class="log-note">$1</span>');
            log = log.replace(/(.+\bwarn(?:ing)?:.+)/g, '<span class="log-warning">$1</span>');
            log = log.replace(/(.+In function .+)/g, '<span class="log-note">$1</span>');
            log = log.replace(/(.+' finished successfully \(.+)/g, '<span class="log-success">$1</span>');
            log = log.replace(/(cc1: .+)/g, '<span class="log-note">$1</span>');
            log = log.replace(/(cc1: all warnings .+)/g, '<span class="log-warning">$1</span>');
            log = '<pre class="build-log" style="height: 100%;">' + log + '</pre>';
            var browserHeight = document.documentElement.clientHeight;
            log = $(log).css({'height': (browserHeight - 130) + 'px', 'overflow': 'auto'});
            CloudPebble.Sidebar.SetActivePane(log);
            // Scroll to the first error, if any.
            setTimeout(function() { if(log.find('.log-error').length) {
                log.scrollTop($(log.find('.log-error')[0]).offset().top - log.offset().top + log.scrollTop());
            }}, 1);
        });
    };

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
            pane.find('#run-build-table').html('');
            $.each(data.builds, function(index, value) {
                pane.find('#run-build-table').append(build_history_row(value));
            });
            if(data.builds.length > 0 && data.builds[0].state == 1) {
                setTimeout(function() { update_build_history(pane); }, 1000);
            }
        });
    };

    var pane = null;
    var init = function() {
        pane = $('#compilation-pane-template').clone();
        pane.find('#install-on-phone-btn').click(function(e) {
            e.preventDefault();
            install_on_watch();
        });
        pane.find('#show-app-logs-btn').click(function(e) {
            e.preventDefault();
            show_app_logs($('#phone-ip').val());
        });
        if(navigator.userAgent.indexOf('Firefox') != -1) {
            pane.find('#firefox-warning').removeClass('hide');
        }
    };

    var m_build_count = 0;
    var show_compile_pane = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("compile")) {
            return;
        }
        // Get build history
        update_build_history(pane);
        pane.find('#compilation-run-build-button').click(function() {
            var temp_build = {started: (new Date()).toISOString(), finished: null, state: 1, uuid: null, id: null, size: {total: null, binary: null, resources: null}};
            update_last_build(pane, temp_build);
            pane.find('#run-build-table').prepend(build_history_row(temp_build));
            var optimisation = $('#build-optimisation').val();
            $.post('/ide/project/' + PROJECT_ID + '/build/run', {optimisation: optimisation}, function() {
                update_build_history(pane);
            });
            ga('send','event', 'build', 'run', {eventValue: ++m_build_count});
        });
        CloudPebble.Sidebar.SetActivePane(pane, 'compile');
        CloudPebble.ProgressBar.Show();
    };

    var update_last_build = function(pane, build) {
        if(build === null) {
            pane.find('#last-compilation').addClass('hide');
            pane.find('#compilation-run-build-button').removeAttr('disabled');
        } else {
            pane.find('#last-compilation').removeClass('hide');
            pane.find('#last-compilation-started').text(CloudPebble.Utils.FormatDatetime(build.started));
            if(build.state > 1) {
                pane.find('#last-compilation-time').removeClass('hide').find('span').text(CloudPebble.Utils.FormatInterval(build.started, build.finished));
                pane.find('#last-compilation-log').removeClass('hide').find('a').attr('href', build.log).off('click').click(function(e) {
                    if(e.ctrlKey || e.metaKey) {
                        ga('send', 'event', 'build log', 'show', 'external');
                        return true;
                    }
                    e.preventDefault();
                    show_build_log(build.id);
                    ga('send', 'event', 'build log', 'show', 'in-app');
                });
                pane.find('#compilation-run-build-button').removeAttr('disabled');
                if(build.state == 3) {
                    pane.find('#last-compilation-pbw').removeClass('hide').find('a:first').attr('href', build.pbw);
                    var url = build.pbw;
                    if(CloudPebble.ProjectInfo.sdk_version == "2" && navigator.userAgent.indexOf("Firefox") == -1) {
                        pane.find("#run-on-phone").removeClass('hide');
                        if(localStorage['cp-last-phone-ip']) {
                            pane.find('#phone-ip').val(localStorage['cp-last-phone-ip']);
                        }
                    } else {
                        pane.find('#last-compilation-qr-code').removeClass('hide').find('img').attr('src', '/qr/?v=' + url);
                    }
                    $('#pbw-shortlink > a').attr('href', '#').text("get short link").unbind('click').click(function() {
                        $('#pbw-shortlink > a').text("generating…").unbind('click');
                        ga('send', 'event', 'short link', 'generate');
                        $.post("/ide/shortlink", {url: url}, function(data) {
                            if(data.success) {
                                $('#pbw-shortlink > a').attr('href', data.url).text(data.url.replace(/^https?:\/\//,'')).click(function() {
                                    ga('send', 'event', 'short link', 'click');
                                });
                            } else {
                                $('#pbw-shortlink > a').text("no shortlink");
                            }
                        });
                    });
                    if(build.size.total !== null) {
                        var s = pane.find('#last-compilation-size').removeClass('hide');
                        s.find('.total').text(Math.round(build.size.total / 1024));
                        s.find('.res').text(Math.round(build.size.resources / 1024)).removeClass('text-error text-warning');
                        s.find('.bin').text(Math.round(build.size.binary / 1024)).removeClass('text-error');
                        if(build.size.resources > 65536) {
                            if(build.size.resources > 98304)
                                s.find('.res').addClass('text-error');
                            else
                                s.find('.res').addClass('text-warning');
                        }
                        if(build.size.binary > 24576) {
                            s.find('.bin').addClass('text-error');
                        }
                    }
                }
            } else {
                pane.find('#last-compilation-time').addClass('hide');
                pane.find('#last-compilation-log').addClass('hide');
                pane.find('#compilation-run-build-button').attr('disabled', 'disabled');
                pane.find('#last-compilation-size').addClass('hide');
            }
            if(build.state != 3) {
                pane.find('#last-compilation-pbw').addClass('hide');
                pane.find('#last-compilation-qr-code').addClass('hide');
                pane.find('#run-on-phone').addClass('hide');
            }
            pane.find('#last-compilation-status')
                .removeClass('label-success label-error label-info')
                .addClass('label-' + COMPILE_SUCCESS_STATES[build.state].label)
                .text(COMPILE_SUCCESS_STATES[build.state].english);
        }
    };

    var mPreviousDisplayLogs = [];
    var mPebble = null;
    var mLogHolder = null;

    var pebble_connect = function(ip) {
        if(mPebble) return mPebble;
        mPebble = new Pebble(ip);
        mPebble.on('app_log', handle_app_log);
        mPebble.on('phone_log', handle_phone_log);
        return mPebble;
    };

    var handle_app_log = function(priority, filename, line_number, message) {
        var log = {
            priority: priority,
            filename: filename,
            line_number: line_number,
            message: message
        };
        mPreviousDisplayLogs.push(log);
        show_log_line(log);
    };

    var handle_phone_log = function(message) {
        var log = {
            priority: -1,
            filename: 'pebble-app.js',
            line_number: '?',
            message: message
        };
        mPreviousDisplayLogs.push(log);
        show_log_line(log);
    };

    var show_log_line = function(log) {
        if(mLogHolder) {
            var display = get_log_label(log.priority) + ' ' + log.filename + ':' + log.line_number + ': ' + log.message + "\n";
            mLogHolder.append($('<span>').addClass(get_log_class(log.priority)).text(display));
        }
    };

    var get_log_class = function(priority) {
        if(priority == -1) return 'log-phone';
        if(priority < 25) return 'log-error';
        if(priority < 75) return 'log-warning';
        if(priority < 150) return 'log-note';
        if(priority < 225) return 'log-debug';
        return 'log-verbose';
    };

    var get_log_label = function(priority) {
        if(priority == -1) return '[PHONE]';
        if(priority < 25) return '[ERROR]';
        if(priority < 75) return '[WARNING]';
        if(priority < 150) return '[INFO]';
        if(priority < 225) return '[DEBUG]';
        return '[VERBOSE]';
    };

    var install_on_watch = function() {
        var ip = $('#phone-ip').val();
        localStorage['cp-last-phone-ip'] = ip;
        var modal = $('#phone-install-progress').modal();
        modal.find('.modal-body > p').text("Installing app on your watch…");
        modal.find('.btn').addClass('hide');
        modal.find('.progress').removeClass('progress-danger progress-success').addClass('progress-striped');
        modal.off('hide');

        var report_error = function(message) {
            modal.find('.modal-body > p').text(message);
            modal.find('.dismiss-btn').removeClass('hide');
            modal.find('.progress').addClass('progress-danger').removeClass('progress-striped');
        };

        try {
            mPebble = pebble_connect(ip);
        } catch(e) {
            report_error("Failed to create socket.");
        }

        mPebble.on('open', function() {
            mPebble.install_app(pane.find('#last-compilation-pbw > a').attr('href'));
        });
        mPebble.on('status', function(code) {
            if(code === 0) {
                mPreviousDisplayLogs = [];
                mPebble.enable_app_logs();
                modal.find('.modal-body > p').text("Installed successfully!");
                modal.find('.btn').removeClass('hide');
                modal.find('.logs-btn').off('click').click(function() {
                    modal.off('hide');
                    show_app_logs();
                    modal.modal('hide');
                });
                modal.on('hide', stop_logs);
                modal.find('.progress').addClass('progress-success').removeClass('progress-striped');
                ga('send', 'event', 'install', 'direct', 'success');
            } else {
                report_error("Installation failed with error code " + code + ". Check your phone for details.");
                ga('send', 'event', 'install', 'direct', 'phone-error');
                mPebble.close();
                mPebble = null;
            }
        });
        mPebble.on('error', function(e) {
            report_error("Installation failed: " + e);
            ga('send', 'event', 'install', 'direct', 'connection-error');
            mPebble = null;
        });
    };

    var show_app_logs = function(ip) {
        if(!mPebble || !mPebble.is_connected()) {
            localStorage['cp-last-phone-ip'] = ip;
            mPebble = pebble_connect(ip);
            mPebble.on('open', function() {
                mPebble.enable_app_logs();
                if(mLogHolder)
                    mLogHolder.append($('<span>').addClass('log-success').text("Connected.\n"));
            });
        }
        mPebble.on('close', function() {
            if(mLogHolder)
                mLogHolder.append($('<span>').addClass('log-error').text("Disconnected from phone.\n"));
        });
        CloudPebble.Sidebar.SuspendActive();
        if(!mLogHolder) {
            var browserHeight = document.documentElement.clientHeight;
            mLogHolder = $('<pre class="build-log">').css({'height': (browserHeight - 130) + 'px', 'overflow': 'auto'});
        } else {
            mLogHolder.empty();
        }
        _.each(mPreviousDisplayLogs, show_log_line);
        CloudPebble.Sidebar.SetActivePane(mLogHolder, undefined, undefined, stop_logs);
    };

    var stop_logs = function() {
        if(mPebble) {
            mPebble.close();
            mPebble = null;
        }
        mPreviousDisplayLogs = [];
        mLogHolder = null;
    };

    return {
        Show: function() {
            show_compile_pane();
        },
        Init: function() {
            init();
        },
        SetOptimisation: function(opt) {
            pane.find('#build-optimisation').val(opt);
        }
    };
})();
