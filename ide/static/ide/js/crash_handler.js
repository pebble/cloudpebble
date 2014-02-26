CloudPebble.CrashChecker = function(app_uuid) {
    var self = this;
    var mDebugCache = null;
    var mDebugInfoURL = null;
    var mAppUUID = app_uuid;

    this.set_debug_info_url = function(url) {
        if(url !== mDebugInfoURL) {
            mDebugCache = null;
            mDebugInfoURL = url;
        }
    };

    var find_pointer_sync = function(pointer) {
        var files = mDebugCache.files;
        var lines = mDebugCache.lines;
        var functions = mDebugCache.functions;

        // First figure out what line we're on.
        var index = _.sortedIndex(lines, [pointer], function(x) { return x[0]; }) - 1;
        if(index < 0) {
            return null;
        }
        var line = lines[index][2];
        var file = files[lines[index][1]];

        // Now also figure out the function.
        var index = _.sortedIndex(functions, [pointer], function(x) { return x[0]; }) - 1;
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

    var find_pc_in_cache = function(pc, success, failure) {
        var result = find_pointer_sync(pc);
        if(result === null) {
            failure("Pointer doesn't point into a user-defined function.");
        } else {
            success(result.file, result.line, result.fn_name, result.fn_line);
        }
    };

    this.find_source_line = function(pc, success, failure) {
        if(mDebugInfoURL === null) {
            failure("No debug info known");
        }

        if(mDebugCache !== null) {
            find_pc_in_cache(pc, success, failure);
            return;
        }

        $.ajax({
            url: mDebugInfoURL,
            dataType: "json"
        }).done(function(data) {
            mDebugCache = data;
            find_pc_in_cache(pc, success, failure)
        }).fail(function() {
            failure("No debug information available for this project; try rebuilding.");
        });
    };

    this.find_source_lines = function(pointers, callback) {
        if(mDebugCache === null) {
            $.ajax({
                url: mDebugInfoURL,
                dataType: "json"
            }).done(function(data) {
                mDebugCache = data;
                self.find_source_lines(pointers, callback);
            });
            return;
        }

        var results = [];
        _.each(pointers, function(pointer) {
            results.push(find_pointer_sync(pointer));
        });
        callback(results);
    };

    this.check_line_for_crash = function(line, crash_callback) {
        var match = line.match(/App fault! {([0-9a-fA-F\-]+)} PC: (\S+) LR: (\S+)/);
        if(match !== null) {
            // We have some sort of crash.
            crash_callback(match[1] === mAppUUID, parseInt(match[2], 16), parseInt(match[3], 16));
        }
    };
};
