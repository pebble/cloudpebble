CloudPebble = CloudPebble || {};
CloudPebble.YCM = new (function() {
    var self = this;
    var PING_INTERVAL = 90000;

    var mInitialised = false;
    var mIsInitialising = false;
    var mFailed = false;
    var mRestarting = false;
    var mURL = null;
    var mUUID = null;
    var mPingTimer = null;

    function pingServer() {
        $.ajax(mURL + '/ping', {
            contentType: 'application/json',
            method: 'POST'
        }).always(function() {
            mPingTimer = _.delay(pingServer, PING_INTERVAL);
        });
    }

    function sendBuffers() {
        var editors = CloudPebble.Editor.GetAllEditors();
        var pending = 0;
        _.each(editors, function(editor) {
            editor.patch_list = [];
            editor.patch_sequence = 0;
            ++pending;

            $.ajax(mURL + '/create', {
                data: JSON.stringify({
                    filename: editor.file_path,
                    content: editor.getValue()
                }),
                contentType: 'application/json',
                method: 'POST'
            }).done(function() {
                if(--pending == 0) {
                    console.log('restart done.');
                    $('.prepare-autocomplete').hide();
                    $('.footer-credits').show();
                    mInitialised = true;
                }
            }).fail(function() {
                mFailed = true;
                console.log('restart failed.');
                $('.prepare-autocomplete').text(gettext("Code completion resync failed."));
            });
        });
    }

    this.initialise = function() {
        if(mInitialised || mIsInitialising || mFailed) {
            return;
        }
        mIsInitialising = true;
        var platforms = (CloudPebble.ProjectInfo.app_platforms || 'aplite,basalt');
        if(CloudPebble.ProjectInfo.sdk_version == '2') {
            platforms = 'basalt';
        }
        $.post('/ide/project/' + PROJECT_ID + '/autocomplete/init', {platforms: platforms})
            .done(function(data) {
                if(data.success) {
                    mUUID = data.uuid;
                    mURL = data.server + 'ycm/' + data.uuid;
                    if(mRestarting) {
                        sendBuffers();
                    } else {
                        mInitialised = true;
                        mPingTimer = _.delay(pingServer, PING_INTERVAL);
                        $('.prepare-autocomplete').hide();
                        $('.footer-credits').show();
                    }
                } else {
                    mFailed = true;
                    $('.prepare-autocomplete').text(gettext("Code completion unavailable."));
                }
            })
            .fail(function() {
                mFailed = true;
                $('.prepare-autocomplete').text(gettext("Code completion unavailable."));
            });
    };

    this.restart = function() {
        if(mRestarting) {
            return;
        }
        clearTimeout(mPingTimer);
        mPingTimer = null;
        mInitialised = false;
        mIsInitialising = false;
        mFailed = false;
        mRestarting = true;
        mURL = false;
        mUUID = null;
        $('.prepare-autocomplete').text(gettext("Code completion lost; retrying...")).show();
        $('.footer-credits').hide();
        this.initialise();
    };

    this.getUUID = function() {
        return mUUID;
    };

    this.deleteFile = function(file) {
        var promise = $.Deferred();
        if(!mInitialised) {
            promise.reject();
            return promise.promise();
        }
        $.ajax(mURL + '/delete', {
            data: JSON.stringify({
                filename: ((file.target == 'worker') ? 'worker_src/' : 'src/') + file.name
            }),
            contentType: 'application/json',
            method: 'POST'
        }).done(function() {
            promise.resolve();
        }).fail(function() {
            promise.reject();
        });
        return promise.promise();
    };

    this.createFile = function(file, content) {
        var promise = $.Deferred();
        if(!mInitialised) {
            promise.reject();
            return promise.promise();
        }
        $.ajax(mURL + '/create', {
            data: JSON.stringify({
                filename: ((file.target == 'worker') ? 'worker_src/' : 'src/') + file.name,
                content: content || ''
            }),
            contentType: 'application/json',
            method: 'POST'
        }).done(function() {
            promise.resolve();
        }).fail(function() {
            promise.reject();
        });
        return promise.promise();
    };

    this.updateResources = function(resources) {
        if(!mInitialised) {
            return;
        }
        var defines = [];
        var counter = 1;
        _.each(resources, function(resource) {
            if(resource.kind != 'png-trans') {
                defines = defines.concat(_.map(resource.identifiers, function(id) {
                    return '#define RESOURCE_ID_' + id + ' ' + (counter++);
                }));
            } else {
                _.each(resource.identifiers, function(id) {
                    defines.push('#define RESOURCE_ID_' + id + '_BLACK ' + (counter++));
                    defines.push('#define RESOURCE_ID_' + id + '_WHITE ' + (counter++));
                })
            }
        });
        defines.push("");
        $.ajax(mURL + '/create', {
            data: JSON.stringify({
                filename: 'build/src/resource_ids.auto.h',
                content: defines.join("\n")
            }),
            contentType: 'application/json',
            method: 'POST'
        });
    };

    this.request = function(endpoint, editor, cursor) {
        var promise = $.Deferred();
        if(!mInitialised) {
            promise.reject();
            return promise.promise();
        }

        cursor = cursor || editor.getCursor();
        var these_patches = editor.patch_list;
        editor.patch_list = [];
        $.ajax(mURL + '/' + endpoint, {
            data: JSON.stringify({
                file: editor.file_path,
                line: cursor.line,
                ch: cursor.ch,
                patches: these_patches
            }),
            contentType: 'application/json',
            method: 'POST',
            timeout: 2000
        }).done(function(data) {
            promise.resolve(data);
        }).fail(function(xhr) {
            editor.patch_list = these_patches.concat(editor.patch_list);
            promise.reject();
            // If we get a 404 status our session is definitively lost and we should create another.
            if(xhr.status == 404) {
                self.restart();
            }
        });
        return promise.promise();
    };
})();
