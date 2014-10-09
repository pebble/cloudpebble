CloudPebble = CloudPebble || {};
CloudPebble.YCM = new (function() {
    var self = this;
    var PING_INTERVAL = 250000;

    var mInitialised = false;
    var mIsInitialising = false;
    var mFailed = false;
    var mURL = null;

    function pingServer() {
        $.ajax(mURL + '/ping', {
            contentType: 'application/json',
            method: 'POST'
        }).done(function() {
            _.delay(pingServer, PING_INTERVAL);
        }).fail(function() {
            mInitialised = false;
            mIsInitialising = false;
            mURL = null;
            self.initialise();
        });
    }

    this.initialise = function() {
        if(mInitialised || mIsInitialising || mFailed) {
            return;
        }
        mIsInitialising = true;
        $.post('/ide/project/' + PROJECT_ID + '/autocomplete/init')
            .done(function(data) {
                if(data.success) {
                    mURL = data.server + 'ycm/' + data.uuid;
                    mInitialised = true;
                    $('.prepare-autocomplete').hide();
                    $('.footer-credits').show();
                    _.delay(pingServer, PING_INTERVAL);
                } else {
                    mFailed = true;
                    $('.prepare-autocomplete').text("Code completion unavailable.");
                }
            })
            .fail(function() {
                mFailed = true;
                $('.prepare-autocomplete').text("Code completion unavailable.");
            });
    };

    this.deleteFile = function(file) {
        var promise = $.Deferred();
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
        return promise;
    };

    this.createFile = function(file, content) {
        var promise = $.Deferred();
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
        return promise;
    }

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
        }).fail(function() {
            editor.patch_list = these_patches.concat(editor.patch_list);
            promise.reject();
            // TODO: This may imply that the server has gone away. Perhaps we should handle that.
        });
        return promise.promise();
    };
})();
