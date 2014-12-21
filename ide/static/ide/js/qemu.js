/**
 * Created by katharine on 12/17/14.
 */

(function() {
    var sLoadedScripts = false;
    window.INCLUDE_URI = "";
    window.QEmu = function (token, canvas, button_map) {
        var self = this;
        var mCanvas = $(canvas);
        var mToken = token;
        var mVNCPort = null;
        var mWSPort = null;
        var mInstanceID = null;
        var mHost = null;
        var mRFB = null;
        var mSecure = false;
        var mPendingDeferred = null;
        var mConnected = false;
        var mSplashURL = null;
        var mGrabbedKeyboard = false;
        var mPingTimer = null;
        var mPingURL = null;
        var mKillURL = null;
        var mButtonMap = button_map;

        _.extend(this, Backbone.Events);

        function spawn(token) {
            var deferred = $.Deferred();
            $.post('/ide/emulator/launch', {token: token})
                .done(function (data) {
                    console.log(data);
                    if (data.success) {
                        mHost = data.host;
                        mVNCPort = data.vnc_ws_port;
                        mWSPort = data.ws_port;
                        mSecure = data.secure;
                        mPingURL = data.ping_url;
                        mKillURL = data.kill_url;
                        mInstanceID = data.uuid;
                        deferred.resolve();
                    } else {
                        deferred.reject(data.error); // for some reason this doesn't make it to its handler.
                    }
                })
                .fail(function () {
                    console.log(':(');
                    deferred.reject("Something went wrong.");
                });
            return deferred.promise();
        }

        function sendPing() {
            $.post(mPingURL)
                .done(function() {
                    console.log('qemu ping!');
                })
                .fail(function() {
                    console.log('ping failed.');
                    self.disconnect();
                });
        }

        function handleStateUpdate(rfb, state, oldstate, msg) {
            if(mPendingDeferred) {
                if(state == 'normal') {
                    mRFB.get_keyboard().ungrab();
                    mPingTimer = setInterval(sendPing, 100000);
                    setTimeout(function() {
                        mPendingDeferred.resolve();
                        mPendingDeferred = null;
                    }, 2000);
                    self.trigger('connected');
                } else if(state == 'failed' || state == 'fatal') {
                    mPendingDeferred.reject();
                    mPendingDeferred = null;
                }
            }
            if(state == 'normal') {
                mConnected = true;
            }
            if(mConnected && state != 'normal') {
                mConnected = false;
                clearInterval(mPingTimer);
                self.trigger('disconnected');
            }
        }

        function handleCanvasClick() {
            if(!mRFB || mGrabbedKeyboard) return true;
            setTimeout(function() {
                mRFB.get_keyboard().grab();
                $(document).on('click', handleNonCanvasClick);
            }, 50);
            mGrabbedKeyboard = true;
            return true;
        }

        function handleNonCanvasClick(e) {
            var target = e.target;
            if($('#emulator-container').find(target).length) {
                return true;
            }
            $(document).off('click', handleNonCanvasClick);
            mGrabbedKeyboard = false;
            if(!mRFB) return true;
            mRFB.get_keyboard().ungrab();
            return true;
        }

        function startVNC() {
            mCanvas.on('click', handleCanvasClick);
            loadScripts(function() {
                Util.init_logging('warn');
                mRFB = new RFB({
                    target: mCanvas[0],
                    encrypt: mSecure,
                    true_color: true, // Ideally this would be false, but qemu doesn't support that.
                    local_cursor: false,
                    shared: true,
                    view_only: false,
                    onUpdateState: handleStateUpdate
                });
                mRFB.get_display()._logo = {
                    width: 144,
                    height: 168,
                    data: mSplashURL
                };
                mRFB.get_display().clear();
                mRFB.connect(mHost, mVNCPort, mToken, '');
            });
        }

        function loadScripts(done) {
            if(!sLoadedScripts) {
                console.log("loading vnc client...");
                Util.load_scripts(URL_VNC_INCLUDES);
                window.onscriptsload = function() {
                    console.log("vnc ready");
                    done();
                }
            } else {
                done();
            }
        }

        function showLaunchSplash() {
            var img = new Image(144, 168);
            img.src = URL_TINTIN_BOOT_PNG;
            img.onload = function() {
                mCanvas[0].getContext('2d').drawImage(img, 0, 0);
                mSplashURL = mCanvas[0].toDataURL();
            };
        }

        this.connect = function() {
            if(mConnected) {
                var deferred = $.Deferred();
                deferred.resolve();
                return deferred.promise();
            }
            if(mPendingDeferred) {
                return deferred.promise();
            }
            showLaunchSplash();
            mPendingDeferred = $.Deferred();
            spawn(mToken)
                .done(function() {
                    startVNC();
                })
                .fail(function() {
                    mPendingDeferred.reject();
                });
            return mPendingDeferred.promise();
        };

        this.disconnect = function() {
            if(!mConnected) {
                return;
            }
            mRFB.disconnect();
            $.post(mKillURL)
                .done(function() {
                    console.log('killed emulator.');
                })
                .fail(function() {
                    console.warn('failed to kill emulator.');
                })
        };

        this.getWebsocketURL = function() {
            return (mSecure ? 'wss' : 'ws') + '://' + mHost + ':' + mWSPort + '/';
        };

        this.handleButton = function(button, down) {
            if(!mRFB) return;
            var buttonMap = {
                'up': XK_Up,
                'select': XK_Right,
                'down': XK_Down,
                'back': XK_Left
            };
            if(!buttonMap[button]) {
                console.error("unknown button " + button);
                return;
            }
            mRFB.sendKey(buttonMap[button], down)
        };

        _.each(mButtonMap, function(element, button) {
            $(element).mousedown(function() {
                self.handleButton(button, true);
                $(document).one('mouseup', function() {
                    self.handleButton(button, false);
                })
            })
        });
    };
})();