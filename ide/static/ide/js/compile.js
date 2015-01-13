CloudPebble.Compile = (function() {
    var MINIMUM_INSTALL_VERSION = "v2.7";

    var COMPILE_SUCCESS_STATES = {
        1: {english: gettext("Pending"), cls: "info", label: 'info'},
        2: {english: gettext("Failed"), cls: "error", label: 'error'},
        3: {english: gettext("Succeeded"), cls: "success", label: 'success'}
    };

    var mPendingCallbacks = [];
    var mRunningBuild = false;

    var mLastBuild = null;
    var mEmulator = null;

    var build_history_row = function(build) {
        var tr = $('<tr>');
        tr.append($('<td class="build-id">' + (build.id === null ? '?' : build.id) + '</td>'));
        tr.append($('<td class="build-date">' + CloudPebble.Utils.FormatDatetime(build.started) + '</td>'));
        tr.append($('<td class="build-state">' + COMPILE_SUCCESS_STATES[build.state].english + '</td>'));
        tr.append($('<td class="build-size">' + (build.size.total !== null ? Math.round(build.size.total / 1024) + ' KiB' : '') + '</td>'));
        tr.append($('<td class="build-pbw">' + (build.state == 3 ? ('<a href="'+build.pbw+'" class="btn btn-small">' + gettext("pbw") + '</a>') : ' ') + '</td>'));
        // Build log thingy.
        var td = $('<td class="build-log">');
        if(build.state > 1) {
            var a = $('<a href="'+build.log+'" class="btn btn-small">' + gettext("Build log") + '</a>').click(function(e) {
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
                alert(interpolate(gettext("Something went wrong:\n\n%s"), [data.error]));
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
            // JavaScript linting failures are errors:
            log = log.replace(/^(src\/js\/.*)$/gm, '<span class="log-error">$1</span>');
            log = log.replace(/^(JavaScript linting failed.*)$/gm, '<span class="log-note">$1</span>');
            // Link the thingies.
            log = log.replace(/([\/a-zA-Z0-9_]+\.[ch]):([0-9+]+)/g, '<span class="filename-link" data-filename="$1" data-line="$2">$1:$2</span>');
            log = '<pre class="build-log" style="height: 100%;">' + log + '</pre>';
            var browserHeight = document.documentElement.clientHeight;
            log = $(log).css({'height': (browserHeight - 130) + 'px', 'overflow': 'auto'});
            // Make the links do something.
            log.find('.filename-link').click(function() {
                var thing = $(this);
                var filename = thing.data('filename').replace(/^(\.\.)?\/?((worker_)?(src))?\/?/, '');
                var line = parseInt(thing.data('line'), 10);
                CloudPebble.Editor.GoTo(filename, line - 1, 0);
            });

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
                alert(interpolate(gettext("Something went wrong:\n%s"), [data.error])); // This should be prettier.
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
            } else if(mRunningBuild) {
                mRunningBuild = false;
                _.each(mPendingCallbacks, function(callback) {
                    callback(data.builds[0].state == 3);
                });
                mPendingCallbacks = [];
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
            show_app_logs();
        });
        pane.find('#screenshot-btn').click(function(e) {
            e.preventDefault();
            take_screenshot();
        });
        pane.find('#android-beta-link').click(function(e) {
            e.preventDefault();
            $('#modal-android-notes').modal();
            CloudPebble.Analytics.addEvent('cloudpebble_android_beta_modal', null, null, ['cloudpebble']);
        });

        pane.find('#install-in-qemu-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(true);
        });
        pane.find('#show-qemu-logs-btn').click(function(e) {
            e.preventDefault();
            show_app_logs(true);
        });
        pane.find('#screenshot-qemu-btn').click(function(e) {
            e.preventDefault();
            take_screenshot(true);
        });
        var targetTabs = pane.find('#run-target-tabs');
        targetTabs.on('shown', function(e) {
            localStorage['activeTarget'] = $(e.target).data('run-target');
        });

        $('#modal-android-notes a.btn-primary').click(function(e) {
            CloudPebble.Analytics.addEvent('cloudpebble_android_beta_download', null, null, ['cloudpebble']);
        });
        mCrashAnalyser = new CloudPebble.CrashChecker(CloudPebble.ProjectInfo.app_uuid);
        pane.find('#compilation-run-build-button').click(function() { run_build(); });
    };

    var m_build_count = 0;
    var show_compile_pane = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("compile")) {
            return;
        }

        update_build_history(pane);
        CloudPebble.Sidebar.SetActivePane(pane, 'compile');
        CloudPebble.ProgressBar.Show();

        var targetTabs = pane.find('#run-target-tabs');
        if(localStorage['activeTarget']) {
            var target = localStorage['activeTarget'];
            targetTabs.find('a[data-run-target=' + target + ']').tab('show');
        }
    };

    var run_build = function(callback) {
        var temp_build = {started: (new Date()).toISOString(), finished: null, state: 1, uuid: null, id: null, size: {total: null, binary: null, resources: null}};
        update_last_build(pane, temp_build);
        pane.find('#run-build-table').prepend(build_history_row(temp_build));
        $.post('/ide/project/' + PROJECT_ID + '/build/run', function() {
            mRunningBuild = true;
            if(callback) {
                mPendingCallbacks.push(callback);
            }
            update_build_history(pane);
        });
        ga('send','event', 'build', 'run', {eventValue: ++m_build_count});
    };

    var update_last_build = function(pane, build) {
        mLastBuild = build;
        if(build === null) {
            pane.find('#last-compilation, .build-stats').addClass('hide');
            pane.find('#compilation-run-build-button').removeAttr('disabled');
        } else {
            pane.find('#last-compilation, .build-stats').removeClass('hide');
            pane.find('#last-compilation-started').text(CloudPebble.Utils.FormatDatetime(build.started));
            if(build.state > 1) {
                pane.find('#last-compilation-time').removeClass('hide').find('span').text(CloudPebble.Utils.FormatInterval(build.started, build.finished));
                pane.find('#last-compilation-log').removeClass('hide').attr('href', build.log).off('click').click(function(e) {
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
                    pane.find('#last-compilation-pbw').removeClass('hide').attr('href', build.pbw);
                    pane.find("#run-on-phone").removeClass('hide');
                    if(build.size.total !== null) {
                        var s = pane.find('#last-compilation-size').removeClass('hide');
                        var sfmt;
                        if(!build.size.worker) {
                            sfmt = gettext("%(total)s KiB (%(resources)s KiB resources, %(appbin)s KiB binary)");
                        } else {
                            sfmt = gettext("%(total)s KiB (%(resources)s KiB resources, %(appbin)s KiB binary, %(workerbin)s KiB worker)");
                        }
                        var stext = interpolate(sfmt, {
                            total: Math.round(build.size.total / 1024),
                            resources: Math.round(build.size.resources / 1024),
                            appbin: Math.round(build.size.binary / 1024),
                            workerbin: Math.round(build.size.worker / 1024)
                        }, true);
                        s.find('.text').text(stext);

                        var memfmt = gettext("%(free)s / %(max)s bytes (%(percent)s%)");

                        var m = pane.find('#last-compilation-app-memory').removeClass('hide');
                        m.find('.text').text(interpolate(memfmt, {
                            free: 24576 - build.size.binary,
                            max: 24576,
                            percent: Math.round((24576 - build.size.binary) / 245.76)
                        }, true));

                        if(build.size.worker) {
                            m = pane.find('#last-compilation-worker-memory').removeClass('hide');
                            m.find('.text').text(interpolate(memfmt, {
                                free: 12800 - build.size.worker,
                                max: 12800,
                                percent: Math.round((12800 - build.size.worker) / 128.00)
                            }, true));
                        } else {
                            pane.find('#last-compilation-worker-memory').addClass('hide')
                        }
                    }
                }
            } else {
                pane.find('#last-compilation-time').addClass('hide');
                pane.find('#last-compilation-log').addClass('hide');
                pane.find('#compilation-run-build-button').attr('disabled', 'disabled');
                pane.find('#last-compilation-size').addClass('hide');
                pane.find('#last-compilation-app-memory').addClass('hide');
                pane.find('#last-compilation-worker-memory').addClass('hide');
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
            mCrashAnalyser.set_debug_info_url(build.debug, build.worker_debug);
        }
    };

    var mPreviousDisplayLogs = [];
    var mPebble = null;
    var mLogHolder = null;
    var mCrashAnalyser = null;
    var LOADING_STATEMENTS = [
        gettext("Reticulating splines…"),
        gettext("Eroding cliffs…"),
        gettext("Charging watches…"),
        gettext("Focusing camera…"),
        gettext("Rendering cats…"),
        gettext("Solving climate change…"),
        gettext("Kickstarting emulator project…"),
        gettext("Herding cats…"),
        gettext("Polishing monocles…"),
        gettext("Drafting master plans…"),
        gettext("Petting unicorns…"),
        gettext("Firing missiles…"),
        gettext("Never giving you up…"),
        gettext("Never letting you down…")
    ];

    $('#emulator-container .power').click(function() {
        if(mEmulator) {
            mEmulator.disconnect();
            mEmulator = null;
            if(mPebble) {
                mPebble.off();
                mPebble.close();
                mPebble = null;
            }
        }
    });

    $('#emulator-container .configure').click(function() {
        if(mEmulator) {
            pebble_connect(true, function(pebble) {
                pebble.request_config_page();
            });
        }
    });

    function pick_element(elements) {
        if(elements.length == 0) {
            return "…";
        }
        var index = Math.floor(Math.random() * elements.length);
        return elements.splice(index, 1)[0];
    }

    var pebble_connect = function(virtual, callback) {
        if(mPebble) {
            if(virtual == mPebble.virtual) {
                callback(mPebble);
                return;
            } else {
                mPebble.off();
                mPebble.close();
                mPebble = null;
            }
        }
        var promise;
        var statementInterval = null;
        if(virtual && !mEmulator) {
            var randomStatements = LOADING_STATEMENTS.slice(0);

            CloudPebble.Prompts.Progress.Show(gettext("Booting emulator…"), gettext("Booting emulator..."));
            statementInterval = setInterval(function() {
                if(statementInterval === null) return;
                CloudPebble.Prompts.Progress.Update(pick_element(randomStatements));
            }, 2500);
            mEmulator = new QEmu($('#emulator-container canvas'), {
                up: $('#emulator-container .up'),
                select: $('#emulator-container .select'),
                down: $('#emulator-container .down'),
                back: $('#emulator-container .back'),
            });
            mEmulator.on('disconnected', function() {
                $('#sidebar').removeClass('with-emulator');
                mEmulator = null;
            });
            promise = mEmulator.connect();
            $('#sidebar').addClass('with-emulator');
        } else {
            promise = $.Deferred().resolve();
        }
        promise
            .done(function() {
                var did_connect = false;
                CloudPebble.Prompts.Progress.Show(gettext("Connecting..."), gettext("Establishing connection..."), function() {
                    if(!did_connect && mPebble) {
                        mPebble.off();
                        mPebble.close();
                        mPebble = null;
                    }
                });
                mPebble = new Pebble(virtual ? mEmulator.getWebsocketURL() : LIBPEBBLE_PROXY, virtual ? mEmulator.getToken() : USER_SETTINGS.token);
                mPebble.virtual = virtual;
                window.mPebble = mPebble;
                mPebble.on('app_log', handle_app_log);
                mPebble.on('phone_log', handle_phone_log);
                mPebble.on('proxy:authenticating', function() {
                    CloudPebble.Prompts.Progress.Update(gettext("Authenticating..."));
                });
                mPebble.on('proxy:waiting', function() {
                    CloudPebble.Prompts.Progress.Update(gettext("Waiting for phone. Make sure the developer connection is enabled."));
                });
                var connection_error = function() {
                    mPebble.off();
                    CloudPebble.Prompts.Progress.Fail();
                    CloudPebble.Prompts.Progress.Update(gettext("Connection interrupted."));
                    mPebble = null;
                };
                mPebble.on('close error', connection_error);
                mPebble.on('open', function() {
                    if(virtual) {
                        // Set the clock to localtime.
                        var date = new Date();
                        mPebble.set_time(date.getTime() - date.getTimezoneOffset() * 60000);
                        console.log("setting pebble clock to localtime.");
                    }
                    did_connect = true;
                    mPebble.off(null, connection_error);
                    mPebble.off('proxy:authenticating proxy:waiting');
                    CloudPebble.Prompts.Progress.Hide();
                    callback(mPebble);
                });
            })
            .fail(function(reason) {
                mEmulator = null;
                CloudPebble.Prompts.Progress.Fail();
                CloudPebble.Prompts.Progress.Update(interpolate(gettext("Emulator boot failed: %s"), ["out of capacity."]));
                $('#sidebar').removeClass('with-emulator');
            })
            .always(function() {
                clearInterval(statementInterval);
                statementInterval = null;
            });
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

    var show_log_line = function(log, ignore_crashes) {
        if(mLogHolder) {
            if(log === null) {
                append_log_html($('<hr>'));
            } else {
                var display = _.escape(get_log_label(log.priority) + ' ' + log.filename + ':' + log.line_number + ': ' + log.message);
                display = display.replace(/([\/a-zA-Z0-9_]+\.[ch]):([0-9+]+)/, '<span class="filename-link" data-filename="$1" data-line="$2">$1:$2</span>');
                var span = $('<span>').addClass(get_log_class(log.priority)).html(display);
                span.find('.filename-link').click(function() {
                    var thing = $(this);
                    var filename = thing.data('filename');
                    if(filename == 'ocess_manager.c') {
                        return;
                    }
                    var line = parseInt(thing.data('line'), 10);
                    CloudPebble.Editor.GoTo(filename, line - 1, 0);
                });
                append_log_html(span);
                if(ignore_crashes !== true) {
                    mCrashAnalyser.check_line_for_crash(log.message, handle_crash);
                }
            }
        }
    };

    var append_log_html = function(html) {
        mLogHolder.append(html).append("\n");
        mLogHolder[0].scrollTop = mLogHolder[0].scrollHeight;
    };

    var handle_crash = function(process, is_our_crash, pc, lr) {
        if(!is_our_crash) {
            append_log_html("<span class='log-warning'>" + gettext("Different app crashed. Only the active app has debugging information available.") + "</span>");
            return;
        }
        mPebble.request_version();
        mPebble.on('version', function(pebble_version) {
            mPebble.off('version');
            append_log_html($("<span class='log-verbose'>" + gettext("Looking up debug information...") + "</span>"));
            mCrashAnalyser.find_source_lines(process, pebble_version, [pc, lr], function(results) {
                var pc_result = results[0];
                var lr_result = results[1];
                CloudPebble.Analytics.addEvent('app_logged_crash', {
                    pc: {
                        pointer: pc,
                        symbol: pc_result
                    },
                    lr: {
                        pointer: lr,
                        symbol: lr_result
                    },
                    did_resolve: !!(pc_result || lr_result)
                }, {
                    // This matches what Android reports, which is completely different from what iOS reports.
                    // Someone should probably fix this.
                    remote_device: {
                        firmware_description: {
                            version: {
                                firmware: {
                                    fw_version: pebble_version.running.version,
                                    recovery_fw_version: pebble_version.recovery.version
                                }
                            }
                        },
                        bt_address: pebble_version.device_address,
                        type: "watch",
                        hw_version: pebble_version.board_revision,
                        serial_number: pebble_version.serial_number
                    }
                });
                if(pc_result === null) {
                    append_log_html("<span class='log-error'>" + gettext("Crashed inside firmware call.") + "</span>");
                } else {
                    var fmt = gettext("Crashed at %(file)s:%(line)s, in %(fn_name)s (starts at %(file)s:%(fn_line)s).");
                    append_log_html($("<span class='log-error'>"))
                        .text(interpolate(fmt, pc_result, true));
                }
                if(lr_result !== null) {
                    if(pc_result === null || (lr_result.fn_name !== pc_result.fn_name)) {
                        fmt = gettext("Which was called from %(file)s:%(line)s, in %(fn_name)s (starts at %(file)s:%(fn_line)s).");
                        append_log_html($("<span class='log-error'>"))
                            .text(interpolate(fmt, lr_result, true));
                    }
                }
            });
        });
    }

    var get_log_class = function(priority) {
        if(priority == -1) return 'log-phone';
        if(priority < 25) return 'log-error';
        if(priority < 75) return 'log-warning';
        if(priority < 150) return 'log-note';
        if(priority < 225) return 'log-debug';
        return 'log-verbose';
    };

    var get_log_label = function(priority) {
        if(priority == -1) return gettext('[PHONE]');
        if(priority < 25) return gettext('[ERROR]');
        if(priority < 75) return gettext('[WARNING]');
        if(priority < 150) return gettext('[INFO]');
        if(priority < 225) return gettext('[DEBUG]');
        return gettext('[VERBOSE]');
    };

    var install_on_watch = function(virtual) {
        var modal = $('#phone-install-progress');

        var report_error = function(message) {
            modal.find('.modal-body > p').html(message);
            modal.find('.dismiss-btn').removeClass('hide');
            modal.find('.progress').addClass('progress-danger').removeClass('progress-striped');
        };

        pebble_connect(virtual, function() {
            mPebble.on('status', function(code) {
                mPebble.off('install:progress');
                if(code === 0) {
                    mPreviousDisplayLogs.push(null);
                    mPebble.enable_app_logs();
                    modal.find('.modal-body > p').text(gettext("Installed successfully!"));
                    modal.find('.btn').removeClass('hide');
                    modal.find('.logs-btn').off('click').click(function() {
                        modal.off('hide');
                        show_app_logs();
                        modal.modal('hide');
                    });
                    modal.on('hide', stop_logs);
                    modal.find('.progress').addClass('progress-success').removeClass('progress-striped').find('.bar').css({width: '100%'});
                    ga('send', 'event', 'install', 'direct', 'success');
                    CloudPebble.Analytics.addEvent('app_install_succeeded');
                } else {
                    report_error(gettext("Installation failed. Check your phone for details."));
                    ga('send', 'event', 'install', 'direct', 'phone-error');
                    CloudPebble.Analytics.addEvent('app_install_failed', {cause: 'rejected'});
                    mPebble.close();
                    mPebble = null;
                }
            });
            mPebble.on('error', function(e) {
                report_error("Installation failed: " + e);
                ga('send', 'event', 'install', 'direct', 'connection-error');
                CloudPebble.Analytics.addEvent('app_install_failed', {cause: 'phone_disconnected'});
                mPebble = null;
            });

            modal.modal();
            modal.find('.modal-body > p').text(gettext("Preparing to install app…"));
            modal.find('.btn').addClass('hide');
            modal.find('.progress').removeClass('progress-danger progress-success').addClass('progress-striped').find('.bar').css({width: '100%'});
            modal.off('hide');
            mPebble.once('version', function(version_info) {
                var version_string = version_info.running.version;
                console.log(version_string);
                // Make sure that we have the required version - but also assume that anyone who has the string 'test'
                // in their firmware version number (e.g. me) knows what they're doing.
                if(/test/.test(version_string) || compare_version_strings(version_string, MINIMUM_INSTALL_VERSION) >= 0) {
                    mPebble.install_app(mLastBuild.pbw);
                    var expectedBytes = (mLastBuild.size.binary + mLastBuild.size.worker + mLastBuild.size.resources);
                    mPebble.on('install:progress', function(bytes) {
                modal.find('.modal-body > p').text(gettext("Installing app on watch…"));
                        modal.find('.progress').removeClass('progress-striped').find('.bar').css({width: (bytes * 100 / expectedBytes) + '%'})
                    });
                } else {
                    mPebble.close();
                    mPebble = null;
                    var fmt = gettext("Please <a href='%(update_url)s'>update your pebble</a> to %(min_version)s to install apps from CloudPebble and the appstore (you're on version %(real_version)s).");
                    var str = interpolate(fmt, {
                        update_url: 'https://developer.getpebble.com/2/getting-started/',
                        min_version: MINIMUM_INSTALL_VERSION,
                        real_version: version_string
                    }, true);
                    report_error(str);
                }
            });
            mPebble.request_version();
        });
    };

    var show_app_logs = function(virtual) {
        var do_stuff = function() {
            mPebble.on('close', function() {
                if(mLogHolder)
                    mLogHolder.append($('<span>').addClass('log-error').text(gettext("Disconnected from phone.") + "\n"));
            });
            CloudPebble.Sidebar.SuspendActive();
            if(!mLogHolder) {
                var browserHeight = document.documentElement.clientHeight;
                mLogHolder = $('<pre class="build-log">').css({'height': (browserHeight - 130) + 'px', 'overflow': 'auto'});
            } else {
                mLogHolder.empty();
            }
            _.each(mPreviousDisplayLogs, _.partial(show_log_line, _, true));
            CloudPebble.Sidebar.SetActivePane(mLogHolder, undefined, undefined, stop_logs);
            CloudPebble.Analytics.addEvent('app_log_view');
        };

        if(!mPebble || !mPebble.is_connected()) {
            pebble_connect(virtual, function() {
                mPebble.enable_app_logs();
                if(mLogHolder) {
                    mLogHolder.append($('<span>').addClass('log-success').text(gettext("Connected.") + "\n"));
                }
                do_stuff();
            });
        } else {
            do_stuff();
        }
    };

    var take_screenshot = function(virtual) {
        var modal = $('#phone-screenshot-display').clone();
        var finished = false;

        pebble_connect(virtual, function() {
            var report_error = function(message) {
                modal.find('.modal-body > p').text(message);
                modal.find('.dismiss-btn').removeClass('hide');
                modal.find('.progress').addClass('progress-danger').removeClass('progress-striped');
            };

            var report_progress = function(percent) {
                modal.find('.progress').removeClass('progress-striped').find('.bar').css({width: percent + '%'});
            };

            mPebble.on('colour', function(colour) {
                modal.find('.screenshot-holder').addClass('screenshot-holder-' + colour);
                mPebble.close();
            });

            mPebble.on('close', function() {
                if(!finished) {
                    report_error(gettext("Disconnected from phone."));
                }
            });

            mPebble.on('screenshot:failed', function(reason) {
                CloudPebble.Analytics.addEvent('app_screenshot_failed');
                report_error("Screenshot failed: " + reason);
                mPebble.close();
            });

            mPebble.on('screenshot:progress', function(received, expected) {
                report_progress((received / expected) * 100);
            });

            mPebble.on('screenshot:complete', function(screenshot) {
                finished = true;
                var screenshot_holder = $('<div class="screenshot-holder">').append(screenshot);
                modal.find('.modal-body')
                    .empty()
                    .append(screenshot_holder)
                    .append("<p>" + gettext("Right click -> Save Image as...") + "</p>")
                    .css({'text-align': 'center'});
                modal.find('.dismiss-btn').removeClass('hide');
                mPebble.request_colour();
                CloudPebble.Analytics.addEvent('app_screenshot_succeeded');
            });
            modal.modal();
            mPebble.request_screenshot();
        });

        modal.on('hide', function() {
            if(mPebble) {
                mPebble.close();
                mPebble = null;
            }
        });
    };

    var stop_logs = function() {
        if(mPebble) {
            mPebble.close();
            mPebble = null;
        }
        mPreviousDisplayLogs.push(null);
        mLogHolder = null;
    };

    // Todo: find somewhere better to put this.
    var compare_version_strings = function(a, b) {
        var split = function(version) {
            return _.map(version.substr(1).split('-')[0].split('.'), _.partial(parseInt, _, 10));
        };

        a = split(a);
        b = split(b);
        var len = Math.max(a.length, b.length);
        for(var i = 0; i < len; ++i) {
            var a_part = a[i] || 0;
            var b_part = b[i] || 0;
            console.log(a_part, b_part);
            if(a_part > b_part) {
                return 1;
            } else if(a_part < b_part) {
                return -1;
            }
        }
        return 0;
    };

    return {
        Show: function() {
            show_compile_pane();
        },
        Init: function() {
            init();
        },
        RunBuild: function(callback) {
            run_build(callback);
        },
        DoInstall: function() {
            install_on_watch(localStorage['activeTarget'] == 'qemu');
        }
    };
})();
