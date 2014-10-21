CloudPebble.CrashChecker = function(app_uuid) {
    var self = this;
    var mAppDebugCache = null;
    var mWorkerDebugCache = null;
    var mAppDebugInfoURL = null;
    var mWorkerDebugInfoURL = null;
    var mAppUUID = app_uuid;

    this.set_debug_info_url = function(app_url, worker_url) {
        if(app_url !== mAppDebugInfoURL) {
            mAppDebugCache = null;
            mAppDebugInfoURL = app_url;
        }
        if(worker_url !== mWorkerDebugInfoURL) {
            mWorkerDebugCache = null;
            mWorkerDebugInfoURL = worker_url;
        }
    };

    var find_pointer_sync = function(process, pointer) {
        var cache = (process == 'app' ? mAppDebugCache : mWorkerDebugCache);
        var files = cache.files;
        var lines = cache.lines;
        var functions = cache.functions;

        // First figure out what line we're on.
        var index = _.sortedIndex(lines, [pointer], function(x) { return x[0]; }) - 1;
        if(index < 0) {
            return null;
        }
        var line = lines[index][2];
        var file = files[lines[index][1]];

        // Now also figure out the function.
        index = _.sortedIndex(functions, [pointer], function(x) { return x[0]; }) - 1;
        if(index < 0) {
            return null;
        }
        var fn_info = functions[index];
        if(pointer > fn_info[1]) {
            return null;
        }

        var fn_name = fn_info[2];
        var fn_line = fn_info[3];
        return {
            file: file,
            line: line,
            fn_name: fn_name,
            fn_line: fn_line
        };
    };

    this.find_source_lines = function(process, version, pointers, callback) {
        if((process == 'app' && mAppDebugCache === null) || (process == 'worker' && mWorkerDebugCache === null)) {
            $.ajax({
                url: (process == 'app' ? mAppDebugInfoURL : mWorkerDebugInfoURL),
                dataType: "json"
            }).done(function(data) {
                if(process == 'app') {
                    mAppDebugCache = data;
                } else {
                    mWorkerDebugCache = data;
                }
                self.find_source_lines(process, version, pointers, callback);
            });
            return;
        }

        var results = [];
        _.each(pointers, function(pointer) {
            results.push(find_pointer_sync(process, pointer));
        });
        callback(results);
    };

    this.check_line_for_crash = function(line, crash_callback) {
        var match = line.match(/(App|Worker) fault! {([0-9a-fA-F\-]+)} PC: (\S+) LR: (\S+)/);
        if(match !== null) {
            // We have some sort of crash.
            crash_callback(match[1].toLowerCase(), match[2] === mAppUUID, parseInt(match[3], 16), parseInt(match[4], 16));
        }
    };
};
