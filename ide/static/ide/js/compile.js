CloudPebble.Compile = (function() {
    var MINIMUM_SDK2_VERSION = "v2.9";
    var MINIMUM_INSTALL_VERSION = "v4.0";
    var MINIMUM_APLITE_VERSION = "v3.12.2";

    var COMPILE_SUCCESS_STATES = {
        1: {english: gettext("Pending"), cls: "info", label: 'info'},
        2: {english: gettext("Failed"), cls: "error", label: 'error'},
        3: {english: gettext("Succeeded"), cls: "success", label: 'success'}
    };

    var mRunningBuild = false;
    var mLastScrollTop = 'bottom';
    var mLastBuild = null;

    var build_history_row = function(build) {
        var tr = $('<tr>');
        tr.append($('<td class="build-id">' + (build.id === null ? '?' : build.id) + '</td>'));
        tr.append($('<td class="build-date">' + CloudPebble.Utils.FormatDatetime(build.started) + '</td>'));
        tr.append($('<td class="build-state">' + COMPILE_SUCCESS_STATES[build.state].english + '</td>'));
        var pbw_badge = $('<td class="build-pbw">').appendTo(tr);
        if (build.state == 3) {
            pbw_badge.append($('<a class="btn btn-small">')
                .attr('href', build.download)
                .text(CloudPebble.ProjectProperties.is_runnable ? gettext("pbw") : gettext("tar.gz")));
        }

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
        return Ajax.Get('/ide/project/' + PROJECT_ID + '/build/' + build + '/log').then(function(data){
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
            log = '<pre class="build-log">' + log + '</pre>';
            log = $(log).css({'height': '100%', 'overflow': 'auto'});
            // Make the links do something.
            log.find('.filename-link').click(function() {
                var thing = $(this);
                var filename = thing.data('filename').replace(/^\//, '');
                var line = parseInt(thing.data('line'), 10);
                CloudPebble.Editor.GoTo({file_path: filename}, line - 1, 0);
            });

            CloudPebble.Sidebar.SetActivePane(log);
            // Scroll to the first error, if any.
            setTimeout(function() { if(log.find('.log-error').length) {
                log.scrollTop($(log.find('.log-error')[0]).offset().top - log.offset().top + log.scrollTop());
            }}, 1);
        }).catch(function(err) {
            alert(interpolate(gettext("Something went wrong:\n\n%s"), [err.message]));
        });
    };

    var update_build_history = function(pane) {
        var check = function() {
            return Ajax.Get('/ide/project/' + PROJECT_ID + '/build/history').then(function(data) {
                CloudPebble.ProgressBar.Hide();
                pane.removeClass('hide');
                if (data.builds.length > 0) {
                    update_last_build(pane, data.builds[0]);
                } else {
                    update_last_build(pane, null);
                }
                pane.find('#run-build-table').html('');
                $.each(data.builds, function (index, value) {
                    pane.find('#run-build-table').append(build_history_row(value));
                });
                if (data.builds.length > 0 && data.builds[0].state == 1) {
                    return Promise.delay(1000).then(function () {
                        return check();
                    });
                } else


                if (mRunningBuild) {
                    mRunningBuild = false;
                    return (data.builds[0].state == 3)
                }
            });
        };


        return check().catch(function(error) {
            alert(interpolate(gettext("Something went wrong:\n%s"), [error.message])); // This should be prettier.
            CloudPebble.Sidebar.DestroyActive();
            throw error;
        });
    };

    var pane = null;
    var init = function() {
        pane = $('#compilation-pane-template').clone();
        pane.find('#install-on-phone-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(ConnectionType.Phone);
        });
        pane.find('#show-app-logs-btn').click(function(e) {
            e.preventDefault();
            show_app_logs(ConnectionType.Phone);
        });
        pane.find('#screenshot-btn, #screenshot-qemu-btn').click(function(e) {
            e.preventDefault();
            take_screenshot();
        });
        pane.find('#android-beta-link').click(function(e) {
            e.preventDefault();
            $('#modal-android-notes').modal();
            CloudPebble.Analytics.addEvent('cloudpebble_android_beta_modal', null, null, ['cloudpebble']);
        });

        pane.find('#install-in-qemu-aplite-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(ConnectionType.QemuAplite);
        });

        pane.find('#install-in-qemu-basalt-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(ConnectionType.QemuBasalt);
        });
        pane.find('#install-in-qemu-chalk-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(ConnectionType.QemuChalk);
        });
        pane.find('#install-in-qemu-diorite-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(ConnectionType.QemuDiorite);
        });
        pane.find('#install-in-qemu-emery-btn').click(function(e) {
            e.preventDefault();
            install_on_watch(ConnectionType.QemuEmery);
        });


        pane.find('#show-qemu-logs-btn').click(function(e) {
            e.preventDefault();
            show_app_logs(ConnectionType.Qemu);
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

        var commands = {};
        commands[gettext("Show Phone Logs")] = function() { show_app_logs(ConnectionType.Phone); };
        commands[gettext("Show Emulator Logs")] = function() { show_app_logs(ConnectionType.Qemu); };
        commands[gettext("Show Last Build Log")] = function() {show_build_log(mLastBuild.id)};
        commands[gettext("Compilation")] = function() { show_compile_pane();};
        commands[gettext("Clear App Logs")] = function() { show_clear_logs_prompt(); };
        commands[gettext("Take Screenshot")] = function() { take_screenshot(); };
        CloudPebble.FuzzyPrompt.AddCommands(commands);

        SharedPebble.on('app_log', handle_app_log);
        SharedPebble.on('phone_log', handle_phone_log);
    };

    var m_build_count = 0;
    var show_compile_pane = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("compile")) {
            return;
        }
        if (!CloudPebble.ProjectProperties.is_runnable) {
            pane.find('#last-compilation').remove();
        }

        update_build_history(pane);
        CloudPebble.Sidebar.SetActivePane(pane, {id: 'compile'});
        CloudPebble.ProgressBar.Show();

        var targetTabs = pane.find('#run-target-tabs');
        if(localStorage['activeTarget']) {
            var target = localStorage['activeTarget'];
            targetTabs.find('a[data-run-target=' + target + ']').tab('show');
        }
        pane.find('#last-compilation-pbw').click(function() {
            if (CloudPebble.ProjectInfo.type == 'package' && CloudPebble.ProjectInfo.interdependencies.length > 0) {
                var href = $(this).attr('href');
                var warning_text = gettext("This package project depends on other CloudPebble packages. " +
                    "Do not publish it until you have changed the dependencies to refer to publically available packages.");
                CloudPebble.Prompts.ConfirmLink("EXPORT PACKAGE", warning_text, href);
                return false;
            }
            else {
                return true;
            }
        });
        if(CloudPebble.ProjectInfo.sdk_version != '3') {
            pane.find('#install-in-qemu-basalt-btn #install-in-qemu-chalk-btn').hide();
        } else {
            pane.find('#install-in-qemu-basalt-btn #install-in-qemu-chalk-btn').show();
        }
    };

    var run_build = function() {
        var temp_build = {started: (new Date()).toISOString(), finished: null, state: 1, uuid: null, id: null, size: {total: null, binary: null, resources: null}};
        update_last_build(pane, temp_build);
        pane.find('#run-build-table').prepend(build_history_row(temp_build));
        return Ajax.Post('/ide/project/' + PROJECT_ID + '/build/run').then(function() {
            mRunningBuild = true;
            return update_build_history(pane);
        });
        ga('send','event', 'build', 'run', {eventValue: ++m_build_count});
    };

    var format_build_size = function(size, max_code, max_worker, max_resources) {
        var sfmt;
        if(!size.worker) {
            sfmt = gettext("%(total)s KiB (%(resources)s\u2008/\u2008%(resource_limit)s KiB resources, %(appbin)s\u2008/\u2008%(appbin_limit)s KiB binary)");
        } else {
            sfmt = gettext("%(total)s KiB (%(resources)s\u2008/\u2008%(resource_limit)s KiB resources, %(appbin)s\u2008/\u2008%(appbin_limit)s KiB binary, %(workerbin)s\u2008/\u2008%(workerbin_limit)s KiB worker)");
        }
        return interpolate(sfmt, {
            total: Math.round((size.resources + size.app + size.worker) / 1024),
            resources: Math.round(size.resources / 1024),
            appbin: Math.round(size.app / 1024),
            workerbin: Math.round(size.worker / 1024),
            resource_limit: Math.round(max_resources / 1024),
            workerbin_limit: Math.round(max_worker / 1024),
            appbin_limit: Math.round(max_code / 1024)
        }, true);
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
                    pane.find('#last-compilation-pbw').removeClass('hide').attr('href', build.download);
                    pane.find("#run-on-phone").removeClass('hide');
                    if(build.sizes) {
                        if(build.sizes.aplite) {
                            var aplite_size_text = format_build_size(build.sizes.aplite, 24576, 10240, 98304);
                            pane.find('#last-compilation-size-aplite').removeClass('hide').find('.text').text(aplite_size_text);
                        } else {
                            pane.find('#last-compilation-size-aplite').addClass('hide');
                        }
                        if(build.sizes.basalt) {
                            var basalt_size_text = format_build_size(build.sizes.basalt, 65536, 10240, 262144);
                            pane.find('#last-compilation-size-basalt').removeClass('hide').find('.text').text(basalt_size_text);
                        } else {
                            pane.find('#last-compilation-size-basalt').addClass('hide');
                        }
                        if(build.sizes.chalk) {
                            var chalk_size_text = format_build_size(build.sizes.chalk, 65536, 10240, 262144);
                            pane.find('#last-compilation-size-chalk').removeClass('hide').find('.text').text(chalk_size_text);
                        } else {
                            pane.find('#last-compilation-size-chalk').addClass('hide');
                        }
                        if(build.sizes.diorite) {
                            var diorite_size_text = format_build_size(build.sizes.diorite, 65536, 10240, 262144);
                            pane.find('#last-compilation-size-diorite').removeClass('hide').find('.text').text(diorite_size_text);
                        } else {
                            pane.find('#last-compilation-size-diorite').addClass('hide');
                        }
                        if(build.sizes.emery) {
                            var emery_size_text = format_build_size(build.sizes.emery, 131072, 10240, 262144);
                            pane.find('#last-compilation-size-emery').removeClass('hide').find('.text').text(emery_size_text);
                        } else {
                            pane.find('#last-compilation-size-emery').addClass('hide');
                        }

                    }
                    // Only enable emulator buttons for built platforms.
                    pane.find('#run-qemu .btn-primary').attr('disabled', function() {
                        return !_.isObject(build.sizes[$(this).data('platform')]);
                    })
                }
            } else {
                pane.find('#last-compilation-time').addClass('hide');
                pane.find('#last-compilation-log').addClass('hide');
                pane.find('#compilation-run-build-button').attr('disabled', 'disabled');
                pane.find('#last-compilation-size-aplite').addClass('hide');
                pane.find('#last-compilation-size-basalt').addClass('hide');
                pane.find('#last-compilation-size-chalk').addClass('hide');
                pane.find('#last-compilation-size-diorite').addClass('hide');
                pane.find('#last-compilation-size-emery').addClass('hide');
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
            mCrashAnalyser.set_debug_info_url(build.build_dir);
        }

    };

    var mPreviousDisplayLogs = [];
    var mLogHolder = null;
    var mCrashAnalyser = null;

    var handle_app_log = function(pebble, priority, filename, line_number, message) {
        var log = {
            priority: priority,
            filename: filename,
            line_number: line_number,
            message: message
        };
        mPreviousDisplayLogs.push(log);
        show_log_line(log);
    };

    var handle_phone_log = function(pebble, message) {
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
                var span = $('<span>').addClass(get_log_class(log.priority)).addClass('log').html(display);
                span.find('.filename-link').click(function() {
                    var thing = $(this);
                    var filename = thing.data('filename');
                    if(filename == 'ocess_manager.c') {
                        return;
                    }
                    var line = parseInt(thing.data('line'), 10);
                    // This could pick the wrong file if two files share the same name! But this is unlikely, since
                    // workers are rarely used anyway.
                    // TODO: Consider a better solution e.g. a pop
                    CloudPebble.Editor.GoTo({name: filename}, line - 1, 0);
                });
                append_log_html(span);
                if(ignore_crashes !== true) {
                    mCrashAnalyser.check_line_for_crash(log.message, handle_crash);
                }
            }
        }
    };

    function logs_scrolled_to_bottom() {
        // Return true if the log window is scrolled to within 20 pixels of the bottom.
        if (!mLogHolder) {
            return false;
        }
        return (mLogHolder[0].scrollHeight - mLogHolder.scrollTop() <= mLogHolder.outerHeight() + 20);
    }

    function scroll_logs_to_bottom() {
        mLogHolder[0].scrollTop = mLogHolder[0].scrollHeight - mLogHolder.outerHeight();
    }

    function restore_scroll_position() {
        if (mLastScrollTop == 'bottom') {
            scroll_logs_to_bottom();
        }
        else if (_.isNumber(mLastScrollTop)) {
            mLogHolder[0].scrollTop = mLastScrollTop;
        }
    }

    var append_log_html = function(html) {
        // Append the HTML line to the log
        var at_bottom = logs_scrolled_to_bottom();
        mLogHolder.append($(html).append("\n"));
        // Then, scroll to the bottom if we were already scrolled to the bottom before.
        if (at_bottom) {
            mLogHolder[0].scrollTop = mLogHolder[0].scrollHeight - mLogHolder.outerHeight();
        }
    };

    var handle_crash = function(process, is_our_crash, pc, lr) {
        if(!is_our_crash) {
            append_log_html("<span class='log-warning'>" + gettext("Different app crashed. Only the active app has debugging information available.") + "</span>");
            return;
        }
        var pebble = SharedPebble.getPebbleNow();
        if(!pebble) {
            return;
        }
        pebble.request_version();
        pebble.on('version', function(pebble_version) {
            pebble.off('version');
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
                    did_resolve: !!(pc_result || lr_result),
                    virtual: SharedPebble.isVirtual()
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
                    append_log_html($("<span class='log-error'>").text(interpolate(fmt, pc_result, true)));
                }
                if(lr_result !== null) {
                    if(pc_result === null || (lr_result.fn_name !== pc_result.fn_name)) {
                        fmt = gettext("Which was called from %(file)s:%(line)s, in %(fn_name)s (starts at %(file)s:%(fn_line)s).");
                        append_log_html($("<span class='log-error'>").text(interpolate(fmt, lr_result, true)));
                    }
                }
            });
        });
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
        if(priority == -1) return gettext('[PHONE]');
        if(priority < 25) return gettext('[ERROR]');
        if(priority < 75) return gettext('[WARNING]');
        if(priority < 150) return gettext('[INFO]');
        if(priority < 225) return gettext('[DEBUG]');
        return gettext('[VERBOSE]');
    };

    function add_log_divider() {
        // Only add a log divider if the previous log entry wasn't also a divider.
        if (_.last(mPreviousDisplayLogs)) {
            mPreviousDisplayLogs.push(null);
        }
    }

    var install_on_watch = function(kind) {
        var modal = $('#phone-install-progress');
        return SharedPebble.getPebble(kind).then(function(pebble) {
            return new Promise(function(resolve, reject) {
                pebble.on('status', function(code) {
                    pebble.off('install:progress');
                    if(code === 0) {
                        add_log_divider();
                        pebble.enable_app_logs();
                        modal.find('.modal-body > p').text(gettext("Installed successfully!"));
                        modal.find('.btn').removeClass('hide');
                        modal.find('.logs-btn').off('click').click(function () {
                            modal.off('hide');
                            show_app_logs();
                            modal.modal('hide');
                        });
                        modal.on('hide', stop_logs);
                        modal.find('.progress').addClass('progress-success').removeClass('progress-striped').find('.bar').css({width: '100%'});
                        ga('send', 'event', 'install', 'direct', 'success');
                        CloudPebble.Analytics.addEvent('app_install_succeeded', {virtual: SharedPebble.isVirtual()});
                        resolve(pebble);
                    } else {
                        if (SharedPebble.isVirtual()) {
                            reject(new Error(gettext("Installation rejected. Try rebooting the emulator and trying again.")));
                        } else {
                            reject(new Error(gettext("Installation rejected. Check your phone for details.")));
                        }
                        ga('send', 'event', 'install', 'direct', 'phone-error');
                        CloudPebble.Analytics.addEvent('app_install_failed', {cause: 'rejected', virtual: SharedPebble.isVirtual()});
                    }
                });
                pebble.on('error', function(e) {
                    reject(new Error("Installation failed: " + e));
                    ga('send', 'event', 'install', 'direct', 'connection-error');
                    CloudPebble.Analytics.addEvent('app_install_failed', {cause: 'phone_disconnected', virtual: SharedPebble.isVirtual()});
                });

                modal.modal();
                modal.find('.modal-body > p').text(gettext("Preparing to install app…"));
                modal.find('.btn').addClass('hide');
                modal.find('.progress').removeClass('progress-danger progress-success').addClass('progress-striped').find('.bar').css({width: '100%'});
                modal.off('hide');
                pebble.once('version', function(version_info) {
                    var version_string = version_info.running.version;
                    console.log(version_string);
                    // Make sure that we have the required version - but also assume that anyone who has the string 'test'
                    // in their firmware version number (e.g. me) knows what they're doing.
                    var min_version;
                    var platform = Pebble.version_to_platform(version_info);
                    if (CloudPebble.ProjectInfo.sdk_version == '2') {
                        min_version = MINIMUM_SDK2_VERSION;
                    } else if (platform == 'aplite') {
                        min_version = MINIMUM_APLITE_VERSION;
                    } else {
                        min_version = MINIMUM_INSTALL_VERSION;
                    }
                    if(/test/.test(version_string) || compare_version_strings(version_string, min_version) >= 0) {
                        var sizes = {
                            aplite: mLastBuild.sizes.aplite,
                            basalt: mLastBuild.sizes.basalt,
                            chalk: mLastBuild.sizes.chalk,
                            diorite: mLastBuild.sizes.diorite,
                            emery: mLastBuild.sizes.emery
                        };
                        var size = sizes[platform];
                        var install_timer = setTimeout(function() {
                            if (SharedPebble.isVirtual()) {
                                reject(new Error(gettext("Installation failed (timeout). Try rebooting the emulator and trying again.")));
                            } else {
                                reject(new Error(gettext("Installation failed; no response from phone.")));
                            }
                            CloudPebble.Analytics.addEvent('app_install_failed', {
                                cause: 'target_not_responding',
                                virtual: SharedPebble.isVirtual()
                            });
                        }, 30000);
                        pebble.install_app(mLastBuild.download);
                        var expectedBytes = (size.binary + size.worker + size.resources);
                        pebble.on('install:progress', function(bytes) {
                            clearTimeout(install_timer);
                            modal.find('.modal-body > p').text(gettext("Installing app on watch…"));
                            if(modal.find('.progress').hasClass('progress-striped')) {
                                modal.find('.progress').addClass('no-animation');
                                _.defer(function() {
                                    modal.find('.progress').removeClass('no-animation');
                                });
                            }
                            modal.find('.progress').removeClass('progress-striped').find('.bar').css({width: (bytes * 100 / expectedBytes) + '%'})
                        });
                    } else {
                        var fmt, str;
                        if(CloudPebble.ProjectInfo.sdk_version != '2' && version_string.substr(0, 3) == "v2.") {
                            fmt = gettext("Please <a href='%(update_url)s' target='_blank'>update your Pebble</a> to firmware %(min_version)s to install apps from CloudPebble (you're on version %(real_version)s).");
                            str = interpolate(fmt, {
                                update_url: "https://help.getpebble.com/customer/portal/articles/2256017",
                                min_version: min_version,
                                real_version: version_string
                            }, true);
                        } else {
                            fmt = gettext("Please launch the Pebble phone app and update your pebble to %(min_version)s to install apps from CloudPebble and the appstore (you're on version %(real_version)s).");
                            str = interpolate(fmt, {
                                min_version: min_version,
                                real_version: version_string
                            }, true);
                        }
                        reject(new Error(str));
                    }
                });
                pebble.request_version();
            }).catch(function(error) {
                modal.find('.modal-body > p').html(error.message);
                modal.find('.dismiss-btn').removeClass('hide');
                modal.find('.progress').addClass('progress-danger').removeClass('progress-striped');
                throw error;
            });
        });
    };

    var show_clear_logs_prompt = function() {
        CloudPebble.Prompts.Confirm(gettext("Clear all app logs?"), gettext("This cannot be undone."), function() {
            ga('send', 'event', 'logs', 'delete');
            CloudPebble.Analytics.addEvent('app_log_clear', {log_length: mPreviousDisplayLogs.length, virtual: SharedPebble.isVirtual()});
            mLogHolder.empty();
            mPreviousDisplayLogs = [];
        });
    };

    var show_app_logs = function(kind) {
        SharedPebble.getPebble(kind).then(function(pebble) {
            pebble.on('close', function() {
                if(mLogHolder)
                    mLogHolder.append($('<span>').addClass('log-error').text(gettext("Disconnected from phone.") + "\n"));
            });
            CloudPebble.Sidebar.SuspendActive();
            if(!mLogHolder) {
                var parentPane = $('<div></div>');
                var logPane = $('<div></div>').addClass("app-log").appendTo(parentPane);
                mLogHolder = $('<pre class="build-log">').appendTo(logPane);
                var buttonHolder = $("<div>").addClass("editor-button-wrapper").appendTo(parentPane);
                $("<button>")
                    .addClass('btn delete-btn')
                    .attr('title', gettext("Clear Logs"))
                    .appendTo(buttonHolder).click(show_clear_logs_prompt);
                $("<a>")
                    .addClass('btn save-btn')
                    .attr('title', gettext("Download Logs"))
                    .attr('download', "CloudPebble.log")
                    .attr('target', '_blank')
                    .appendTo(buttonHolder)
                    .click(function() {
                        this.href = "data:text/plain;base64,"+btoa(mLogHolder.text());
                        CloudPebble.Analytics.addEvent('app_log_download', {log_length: mPreviousDisplayLogs.length, virtual: SharedPebble.isVirtual()});
                    });
            } else {
                mLogHolder.empty();
            }
            _.each(mPreviousDisplayLogs, _.partial(show_log_line, _, true));
            CloudPebble.Sidebar.SetActivePane(parentPane, {onDestroy: stop_logs});
            CloudPebble.Analytics.addEvent('app_log_view', {virtual: SharedPebble.isVirtual()});
            restore_scroll_position();
        });
    };

    var take_screenshot = function(kind) {
        var modal = $('#phone-screenshot-display').clone();
        var finished = false;

        SharedPebble.getPebble(kind).then(function(pebble) {
            var report_error = function(message) {
                modal.find('.modal-body > p').text(message);
                modal.find('.dismiss-btn').removeClass('hide');
                modal.find('.progress').addClass('progress-danger').removeClass('progress-striped');
            };

            var report_progress = function(percent) {
                modal.find('.progress').removeClass('progress-striped').find('.bar').css({width: percent + '%'});
            };

            pebble.on('colour', function(colour) {
                if (colour == 'unknown') {
                    switch (SharedPebble.getPlatformName()) {
                        case 'aplite':
                            colour = 'tintin-red';
                            break;
                        case 'basalt':
                            colour = 'snowy-red';
                            break;
                        case 'chalk':
                            colour = 'spalding-14mm-rose-gold';
                            break;
                        case 'diorite':
                            // TODO: Diorite - update with new watch 'colour' images when they are available
                            colour = 'tintin-red';
                            break;
                        case 'emery':
                            // TODO: Emery - update with new watch colour images.
                            colour = 'tintin-red';
                            break;
                    }
                }
                modal.find('.screenshot-holder').addClass('screenshot-holder-' + colour);
            });

            pebble.on('close', function() {
                report_error(gettext("Disconnected from phone."));
            });

            pebble.on('screenshot:failed', function(reason) {
                CloudPebble.Analytics.addEvent('app_screenshot_failed', {virtual: SharedPebble.isVirtual()});
                report_error("Screenshot failed: " + reason);
            });

            pebble.on('screenshot:progress', function(received, expected) {
                report_progress((received / expected) * 100);
            });

            pebble.on('screenshot:complete', function(screenshot) {
                finished = true;
                var screenshot_holder = $('<div class="screenshot-holder">').append(screenshot);
                modal.find('.modal-body')
                    .empty()
                    .append(screenshot_holder)
                    .append("<p>" + gettext("Right click -> Save Image as...") + "</p>")
                    .css({'text-align': 'center'});
                modal.find('.dismiss-btn').removeClass('hide');
                pebble.request_colour();
                CloudPebble.Analytics.addEvent('app_screenshot_succeeded', {virtual: SharedPebble.isVirtual()});
            });
            modal.modal();
            pebble.request_screenshot();
        });

        modal.on('hide', function() {
            if(!SharedPebble.isVirtual()) {
                SharedPebble.disconnect()
            }
        });
    };

    var stop_logs = function() {
        if(!SharedPebble.isVirtual()) {
            SharedPebble.disconnect();
        }
        add_log_divider();
        mLastScrollTop = (mLogHolder ? (logs_scrolled_to_bottom() ? 'bottom' : mLogHolder[0].scrollTop) : mLastScrollTop);
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
        RunBuild: function() {
            return run_build();
        },
        /**
         * Get the platform to install and run the the app on, given details of the project and last build.
         * @returns {number}
         */
        GetPlatformForInstall: function() {
            if(localStorage['activeTarget'] == 'device') {
                return ConnectionType.Phone;
            } else {
                if(SharedPebble.isVirtual()) {
                    return ConnectionType.Qemu;
                } else {
                    if(CloudPebble.ProjectInfo.sdk_version == '3') {
                        if (!CloudPebble.ProjectInfo.app_platforms) {
                            return ConnectionType.QemuBasalt;
                        }
                        if (CloudPebble.ProjectInfo.app_platforms.indexOf('chalk') > -1) {
                            return ConnectionType.QemuChalk;
                        }
                        else if (CloudPebble.ProjectInfo.app_platforms.indexOf('basalt') > -1) {
                            return ConnectionType.QemuBasalt;
                        }
                        else if (CloudPebble.ProjectInfo.app_platforms.indexOf('aplite') > -1) {
                            return ConnectionType.QemuAplite;
                        }
                        else if (CloudPebble.ProjectInfo.app_platforms.indexOf('diorite') > -1) {
                            return ConnectionType.QemuDiorite;
                        }
                        else if(CloudPebble.ProjectInfo.app_platforms.indexOf('emery') > -1) {
                            return ConnectionType.QemuEmery;
                        }
                    } else {
                        return ConnectionType.QemuAplite;
                    }
                }
            }
        },
        DoInstall: function() {
            return install_on_watch(CloudPebble.Compile.GetPlatformForInstall());
        }
    };
})();
