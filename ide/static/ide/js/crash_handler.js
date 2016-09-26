CloudPebble.CrashChecker = function(app_uuid) {
    var self = this;
    var mSymbolCache = {};
    var mBuildDir = null;
    var mAppUUID = app_uuid;

    this.set_debug_info_url = function(build_dir) {
        mBuildDir = build_dir;
        mSymbolCache = {};
    };

    var find_pointer_sync = function(platform, process, pointer) {
        var cache = cache_lookup(process, platform);
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

    function cache_lookup(process, platform) {
        return mSymbolCache[platform + '/' + process];
    }

    var platform_mappings = {
        app: {
            unknown: ['debug_info.json'],
            aplite: ['debug_info.json'],
            basalt: ['basalt_debug_info.json', 'debug_info.json'],
            chalk: ['chalk_debug_info.json', 'debug_info.json'],
            diorite: ['diorite_debug_info.json', 'debug_info.json'],
            emery: ['emery_debug_info.json', 'debug_info.json']
        },
        worker: {
            unknown: ['worker_debug_info.json'],
            aplite: ['worker_debug_info.json'],
            basalt: ['basalt_worker_debug_info.json', 'worker_debug_info.json'],
            chalk: ['chalk_worker_debug_info.json', 'worker_debug_info.json'],
            diorite: ['diorite_worker_debug_info.json', 'worker_debug_info.json'],
            emery:['emery_worker_debug_info.json', 'worker_debug_info.json']
        }
    };

    function get_debug_json(platform, process) {
        function go(urls) {
            if (urls.length == 0) {
                return Promise.reject(new Error());
            }
            var url = urls[0];
            return Ajax.Ajax({
                url: mBuildDir + url,
                dataType: 'json'
            }).catch(function() {
                return go(urls.slice(1));
            });
        }
        return go(platform_mappings[process][platform]);
    }

    this.find_source_lines = function(process, version, pointers, callback) {
        var platform = Pebble.version_to_platform(version);
        if(!cache_lookup(process, platform)) {
            get_debug_json(platform, process).then(function(data) {
                mSymbolCache[platform + '/' + process] = data;
                self.find_source_lines(process, version, pointers, callback);
            });
            return;
        }

        var results = [];
        _.each(pointers, function(pointer) {
            results.push(find_pointer_sync(platform, process, pointer));
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
