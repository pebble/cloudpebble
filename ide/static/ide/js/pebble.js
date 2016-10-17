/**
 * Created by katharine on 1/15/15.
 */

var ConnectionType = {
    None: 0,
    Phone: 1,
    Qemu: 2,
    QemuAplite: 6,
    QemuBasalt: 10,
    QemuChalk: 18,
    QemuDiorite: 34,
    QemuEmery: 66
};

var ConnectionPlatformNames = {
    2: 'aplite',
    6: 'aplite',
    10: 'basalt',
    18: 'chalk',
    34: 'diorite',
    66: 'emery'
};

var SharedPebble = new (function() {
    var self = this;
    var mPebble = null;
    var mConnectionType = ConnectionType.None;
    var mEmulator = null;

    _.extend(this, Backbone.Events);

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
        gettext("Never letting you down…"),
        gettext("Here comes Tom!")
    ];

    function isRound(kind) {
        return ((kind & ConnectionType.QemuChalk) == ConnectionType.QemuChalk);
    }

    function isRobert(kind) {
        return ((kind & ConnectionType.QemuEmery) == ConnectionType.QemuEmery);
    }

    function _getEmulator(kind) {
        var statementInterval = null;
        var randomStatements = LOADING_STATEMENTS.slice(0);

        CloudPebble.Prompts.Progress.Show(gettext("Booting emulator…"), gettext("Booting emulator..."));
        statementInterval = setInterval(function() {
            if(statementInterval === null) return;
            CloudPebble.Prompts.Progress.Update(pickElement(randomStatements));
        }, 2500);
        var emulator_container = $('#emulator-container');
        mEmulator = new QEmu(ConnectionPlatformNames[kind], emulator_container.find('canvas'), {
            up: emulator_container.find('.up'),
            select: emulator_container.find('.select'),
            down: emulator_container.find('.down'),
            back: emulator_container.find('.back'),
        });
        window.emu = mEmulator;
        var hide_emulator = function() {
            $('#sidebar').removeClass('with-emulator');
            mEmulator = null;
        };
        mEmulator.on('disconnected', hide_emulator);
        $('#sidebar').addClass('with-emulator');
        var canvas_size = URL_BOOT_IMG[ConnectionPlatformNames[kind]].size;
        emulator_container.removeClass('emulator-round emulator-robert');
        if (isRound(kind)) {
            emulator_container.addClass('emulator-round');
        } else if (isRobert(kind)) {
            emulator_container.addClass('emulator-robert');
        }
        emulator_container.find('canvas').attr('width', canvas_size[0]).attr('height', canvas_size[1]);
        mEmulator.on('disconnected', handleEmulatorDisconnected);
        return mEmulator.connect().catch(function(err) {
            hide_emulator();
            CloudPebble.Prompts.Progress.Fail();
            CloudPebble.Prompts.Progress.Update(err.message);
            throw err;
        }).then(function() {
            return mEmulator;
        }).finally(function() {
            clearInterval(statementInterval);
        });
    }

    this.getEmulator = function(kind) {
        if(mEmulator != null) {
            if((kind & mConnectionType) == kind) {
                return Promise.resolve(mEmulator);
            } else {
                return mEmulator.disconnect(true).then(function() {
                    return _getEmulator(kind);
                });
            }
        }
        else {
            return _getEmulator(kind);
        }

    };

    function handleEmulatorDisconnected() {
        if(mPebble && (mConnectionType & ConnectionType.Qemu)) {
            mPebble.close();
            mEmulator = null;
        }
    }

    this.getPebble = function(kind) {
        if(mPebble && mPebble.is_connected()) {
            if(kind === undefined || mConnectionType == kind || (kind == ConnectionType.Qemu && self.isVirtual())) {
                return Promise.resolve(mPebble);
            }
        }

        var watchPromise;

        if(kind & ConnectionType.Qemu) {
            watchPromise = self.getEmulator(kind);
        } else {
            watchPromise = Promise.resolve();
        }
        return watchPromise.then(function() {
            return new Promise(function(resolve, reject) {
                var did_connect = false;
                mConnectionType = kind;
                CloudPebble.Prompts.Progress.Show(gettext("Connecting..."), gettext("Establishing connection..."), function() {
                    if(!did_connect && mPebble) {
                        mPebble.off();
                        mPebble.close();
                        reject(new Error(gettext("Connection interrupted.")));
                    }
                });
                mPebble = new Pebble(getWebsocketURL(), getToken());
                mPebble.on('all', handlePebbleEvent);
                mPebble.on('proxy:authenticating', function() {
                    CloudPebble.Prompts.Progress.Update(gettext("Authenticating..."));
                });
                mPebble.on('proxy:waiting', function() {
                    CloudPebble.Prompts.Progress.Update(gettext("Waiting for phone. Make sure the developer connection is enabled."));
                });
                var connectionError = function() {
                    reject(new Error(gettext("Connection interrupted")));
                };
                mPebble.on('close error', connectionError);
                mPebble.on('open', function() {
                    if(self.isVirtual()) {
                        var date = new Date();
                        if((mConnectionType & ConnectionType.QemuAplite) != ConnectionType.QemuAplite) {
                            // Set pebble timezone
                            mPebble.set_time_utc(date.getTime());
                            console.log("setting pebble clock to utc.");
                        } else {
                            // Set the clock to localtime.
                            mPebble.set_time(date.getTime() - date.getTimezoneOffset() * 60000);
                            console.log("setting pebble clock to localtime.");
                        }
                    }
                    mPebble.enable_app_logs();
                    did_connect = true;
                    mPebble.off(null, connectionError);
                    mPebble.off('proxy:authenticating proxy:waiting');
                    CloudPebble.Prompts.Progress.Hide();
                    resolve(mPebble);
                });
            }).catch(function(error) {
                mPebble.off();
                mPebble = null;
                mEmulator = null;
                CloudPebble.Prompts.Progress.Fail();
                CloudPebble.Prompts.Progress.Update(interpolate(gettext("Emulator boot failed: %s"), [error.message]));
                $('#sidebar').removeClass('with-emulator');
                throw error;
            });
        });
    };

    this.getPebbleNow = function() {
        return mPebble;
    };

    this.disconnect = function(shutdown) {
        var close_pebble = null;
        var disconnect_emu = null;

        if(mPebble) {
            close_pebble = new Promise(function(resolve) {
                mPebble.disable_app_logs();
                mPebble.close();
                // Wait for a close or error event before disabling events,
                // in order to allow the events to be received by any listeners
                mPebble.on('close error', function() {
                    mPebble.off();
                    mPebble = null;
                    resolve(true);
                });
                mConnectionType = ConnectionType.None;
            });
        }
        if(shutdown === true && mEmulator) {
            disconnect_emu = mEmulator.disconnect();
            mEmulator = null;
        }

        return Promise.join(close_pebble, disconnect_emu).then(function(pebble_closed, emu_disconnected) {
            return pebble_closed || emu_disconnected;
        });
    };

    this.isVirtual = function() {
        return mPebble && !!(mConnectionType & ConnectionType.Qemu);
    };

    this.getPlatformName = function() {
        return ConnectionPlatformNames[mConnectionType];
    };

    function getWebsocketURL() {
        return (mConnectionType & ConnectionType.Qemu)? mEmulator.getWebsocketURL() : LIBPEBBLE_PROXY;
    }

    function getToken() {
        return (mConnectionType & ConnectionType.Qemu) ? mEmulator.getToken() : USER_SETTINGS.token;
    }

    function pickElement(elements) {
        if(elements.length == 0) {
            return "…";
        }
        var index = Math.floor(Math.random() * elements.length);
        return elements.splice(index, 1)[0];
    }

    function handlePebbleEvent() {
        var args = Array.prototype.slice.call(arguments, 0);
        var event = args.shift();
        self.trigger.apply(self, [event, mPebble].concat(args));
    }
})();
