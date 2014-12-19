/**
 * Created by katharine on 12/17/14.
 */

(function() {
    var sLoadedScripts = false;
    window.INCLUDE_URI = "/static/ide/external/vnc/";
    window.QEmu = function (token, canvas) {
        var self = this;
        var mCanvas = $(canvas);
        var mToken = token;
        var mVNCPort = null;
        var mWSPort = null;
        var mInstanceID = null;
        var mHost = null;
        var mChildWindow = null;
        var mRFB = null;
        var mSecure = false;
        var mPendingDeferred = null;
        var mConnected = false;

        function spawn(token) {
            var deferred = $.Deferred();
            $.post('/ide/emulator/launch', {token: token})
                .done(function (data) {
                    console.log(data);
                    if (data.success) {
                        mHost = data.host;
                        mVNCPort = data.vnc_ws_port;
                        mWSPort = data.ws_port;
                        mInstanceID = data.uuid;
                        deferred.resolve();
                    } else {
                        deferred.reject(data.error);
                    }
                })
                .fail(function () {
                    console.log(':(');
                    deferred.reject("Something went wrong.");
                });
            return deferred.promise();
        }

        function handleStateUpdate(rfb, state, oldstate, msg) {
            console.log(oldstate + " -> " + state + ": " + msg);
            if(mPendingDeferred) {
                if(state == 'normal') {
                    setTimeout(function() {
                        mPendingDeferred.resolve();
                        mPendingDeferred = null;
                    }, 2000);
                } else if(state == 'failed' || state == 'fatal') {
                    mPendingDeferred.reject();
                    mPendingDeferred = null;
                }
            }
        }

        function startVNC() {
            loadScripts(function() {
                Util.init_logging('info');
                mRFB = new RFB({
                    target: mCanvas[0],
                    encrypt: mSecure,
                    true_color: true,
                    local_cursor: false,
                    shared: true,
                    view_only: false,
                    onUpdateState: handleStateUpdate,
                    onPasswordRequired: sendPassword
                });
                mRFB.connect(mHost, mVNCPort, mToken, '');
            });
        }

        function sendPassword() {
            console.log('password request');
            mRFB.sendPassword(mToken);
        }

        function loadScripts(done) {
            if(!sLoadedScripts) {
                console.log("loading vnc client...");
                Util.load_scripts(["webutil.js", "base64.js", "websock.js", "des.js",
                   "keysymdef.js", "keyboard.js", "input.js", "display.js",
                   "jsunzip.js", "rfb.js", "keysym.js"]);
                window.onscriptsload = function() {
                    console.log("vnc ready");
                    done();
                }
            } else {
                done();
            }
        }

        this.connect = function() {
            if(mConnected) {
                var deferred = $.Deferred();
                deferred.reject();
                return deferred.promise();
            }
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

        this.getWebsocketURL = function() {
            return (mSecure ? 'wss' : 'ws') + '://' + mHost + ':' + mWSPort + '/';
        };
    };
})();