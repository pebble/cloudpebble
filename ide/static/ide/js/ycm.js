CloudPebble = CloudPebble || {};

/**
 * EventedWebSocket is a promise-based websocket interface. It sends JSON messages
 * and adds an integer '_id' attribute to all messages, which is used to connect
 * responses to requests.
 * @param {string} host URL of websocket to connect to
 * @constructor
 */
var EventedWebSocket = function(host) {
    var self = this;
    var mSocket = null;
    var ids = {};

    _.extend(this, Backbone.Events);

    /** Connect to a host, returning a promise which is resolved on successful connection.
     * @returns {Promise}
     */
    this.connect = function() {
        return new Promise(function(resolve, reject) {
            mSocket = new WebSocket(host);
            mSocket.onerror = function(e) {
                self.trigger('error', e);
                reject(e);
            };
            var close_listener = mSocket.addEventListener("close", function(error) {
                self.trigger('close', error);
                ids = {};
                mSocket.removeEventListener("close", close_listener);
                mSocket = null;
            }, false);

            mSocket.onopen = function() {
                self.trigger('open');
                resolve();
            };
        });

    };
    
    /** Send an object (as JSON). The returned promise will be resolved or rejected
     * depending on the value of the 'success' key in the response.
     * @param {object} data
     * @returns {Promise}
     */
    this.send = function(data) {
        var socket = mSocket;
        return new Promise(function(resolve, reject) {
            var on_message, on_close, remove_listeners;
            var id = 0;
            // Take the first free ID
            while(id in ids) id++;
            ids[id] = true;
            data._id = id;

            remove_listeners = function() {
                socket.removeEventListener("message", on_message);
                socket.removeEventListener("close", on_close);
            };
            on_message = function(e) {
                // Deal with the message if it a response to the one we sent.
                var data = JSON.parse(e.data);
                var m_id = data._id;
                if (m_id == id) {
                    remove_listeners();
                    delete ids[id];
                    if (!data.success) {
                        reject(new Error(data.error));
                    }
                    else {
                        resolve(data);
                    }
                }
            };
            on_close = function() {
                // If the socket closes, reject all open promises.
                reject(new Error(gettext("Socket closed.")));
            };
            socket.addEventListener("message", on_message, false);
            socket.addEventListener("close", on_close, false);
            // Send the data as a JSON encoded string
            socket.send(JSON.stringify(data));
        });
    };
};

CloudPebble.YCM = new (function() {
    var self = this;
    var PING_INTERVAL = 90000;

    var mInitialised = false;
    var mIsInitialising = false;
    var mFailed = false;
    var mRestarting = false;
    var mURL = null;
    var mSocket = null;
    var mUUID = null;
    var mPingTimer = null;
    var mInitPromise = null;

    function pingServer() {
        ws_send('ping',{}).finally(function() {
            mPingTimer = _.delay(pingServer, PING_INTERVAL);
        });
    }

    function ws_send(command, data, timeout) {
        var packet = {
            'command': command,
            'data': data
        };
        if (mSocket) {
            return mSocket.send(packet, timeout);
        }
    }
    function sendBuffers() {
        var editors = CloudPebble.Editor.GetAllEditors();
        var pending = 0;
        _.each(editors, function(editor) {
            editor.patch_list = [];
            editor.patch_sequence = 0;
            ++pending;

            ws_send('create', {
                    filename: editor.file_path,
                    content: editor.getValue()
            }).then(function() {
                if(--pending == 0) {
                    console.log('restart done.');
                    $('.prepare-autocomplete').hide();
                    $('.footer-credits').show();
                    mInitialised = true;
                    mRestarting = false;
                }
            }).catch(function() {
                mFailed = true;
                $('.prepare-autocomplete').text(gettext("Code completion resync failed."));
            });
        });
    }

    this.initialise = function() {
        if(mInitialised || mIsInitialising || mFailed) {
            return mInitPromise;
        }
        mIsInitialising = true;
        var platforms = (CloudPebble.ProjectInfo.app_platforms || 'aplite,basalt');
        if(CloudPebble.ProjectInfo.sdk_version == '2') {
            platforms = 'aplite';
        }
        var sdk_version = CloudPebble.ProjectInfo.sdk_version;
        var spinup_data;
        mInitPromise = Ajax.Post('/ide/project/' + PROJECT_ID + '/autocomplete/init', {platforms: platforms, sdk: sdk_version})
            .then(function(data) {
                spinup_data = data;
                mUUID = data.uuid;
                mURL = data.server + 'ycm/' + data.uuid + '/ws';
                mSocket = new EventedWebSocket(mURL);

                mSocket.on('close error', function() {
                    setTimeout(function() {self.restart();}, 1000);
                });
                return mSocket.connect();
            }).then(function() {
                if(mRestarting) {
                    sendBuffers();
                } else {
                    mInitialised = true;
                    mPingTimer = _.delay(pingServer, PING_INTERVAL);
                    $('.prepare-autocomplete').hide();
                    $('.footer-credits').show();
                }
                return spinup_data;
            }).catch(function(e) {
                mFailed = true;
                $('.prepare-autocomplete').text(gettext("Code completion unavailable."));
                throw e;
            });
        return mInitPromise;

    };

    this.restart = function() {
        if(mRestarting) {
            return mInitPromise ? mInitPromise : Promise.reject(new Error("Failed to restart"));
        }
        clearTimeout(mPingTimer);
        mPingTimer = null;
        mInitialised = false;
        mIsInitialising = false;
        mFailed = false;
        mRestarting = true;
        mURL = false;
        mSocket = null;
        mUUID = null;
        $('.prepare-autocomplete').text(gettext("Code completion lost; retrying...")).show();
        $('.footer-credits').hide();
        return this.initialise();
    };

    this.getUUID = function() {
        return mUUID;
    };

    this.deleteFile = function(file) {
        if(!mInitialised) {
            // We resolve here (and in createFile) because YCM not working isn't actually a problem.
            return Promise.resolve();
        }
        return ws_send('delete', {
            filename: file.file_path
        });
    };

    this.renameFile = function(old_file_path, new_file_path) {
        return ws_send('rename', {
            filename: old_file_path,
            new_filename: new_file_path
        })
    };

    this.createFile = function(file, content) {
        if(!mInitialised) {
            return Promise.resolve();
        }
        return ws_send('create', {
            filename: file.file_path,
            content: content || ''
        });
    };

    this.updateResources = function(resources) {
        if(!mInitialised) {
            return;
        }
        var tuples = [];
        _.each(resources, function(resource) {
            _.each(resource.identifiers, function(id) {
                tuples.push([resource.kind, id]);
            })
        });
        return ws_send('resources', {'resources': tuples});
    };

    this.updateAppkeys = function(app_key_names) {
        if (!mInitialised) {
            return;
        }
        return ws_send('messagekeys', {'messagekeys': app_key_names});
    };

    this.updateDependencies = function(dependencies) {
        if(!mInitialised) {
            if (mInitPromise) {
                return mInitPromise.then(function() {
                    return this.updateDependencies(dependencies);
                }.bind(this));
            }
        }
        return ws_send('dependencies', {
            'dependencies': dependencies
        })
    };

    this.request = function(endpoint, editor, cursor) {
        var init_step = Promise.resolve();
        if (mFailed) {
            var err = new Error("YCM not functioning");
            err.noYCM = true;
            return Promise.reject(err);
        }
        else if (!mInitialised) {
            init_step = this.initialise();
        }
        cursor = cursor || editor.getCursor();
        var these_patches = editor.patch_list;
        editor.patch_list = [];
        return init_step.then(function() {
            return ws_send(endpoint, {
                file: editor.file_path,
                line: cursor.line,
                ch: cursor.ch,
                patches: these_patches
            })
        }).then(function(data) {
            return data['data'];
        });
    };
})();
