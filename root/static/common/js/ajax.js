Ajax = (function() {
    /** Print a Python traceback into the console, if it exists. */
    function handle_traceback(tb) {
        if (tb) {
            console.log(tb);
        }
    }
    
    /**
     * Make a Deferred wrapper
     * @param {string} success_key The name of the key in the JSON result object which must have a truthy
     * value for the request to be considered successful.
     * @constructor
     */
    var Wrapper = function (success_key) {
        /** Wrap a jQuery Ajax deferred object in an ES6-compliant promise.
         *
         * The promise will fail if the HTTP request fails, _or_ if the request
         * returns a JSON object containing "success: false".
         *
         * The rejection will be an Error instance, and may include properties from the jqXHR
         * object if the HTTP request returned an an error code.
         * Being an Error, it will always have a .message property with some kind of message.
         *
         * If the server's JSON object contains a .error property, .message will be set to that.
         * Otherwise, .message will come from jQuery's "errorThrown" parameter. Either way,
         * the object will have a toString() function which just returns .messsage
         *
         * @param {jQuery.Deferred} deferred a jQuery Deferred object
         * @returns {Promise}
         */
        this.wrap = function (deferred) {
            return new Promise(function (resolve, reject) {
                deferred.then(function (data) {
                    if (_.isObject(data) && !!success_key && !data[success_key]) {
                        handle_traceback(data.traceback);
                        reject(data.error ? new Error(data.error) : new Error(gettext("Unknown error")));
                    }
                    else {
                        resolve(data);
                    }
                }).fail(function (jqXHR, failKind, errorStatusText) {
                    var message;
                    if (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) {
                        message = jqXHR.responseJSON.error;
                        handle_traceback(jqXHR.responseJSON.traceback);
                    }
                    else {
                        message = errorStatusText;
                    }
                    var error = new Error(message);
                    if (jqXHR) {
                        error.jqXHR = jqXHR;
                        error.status = jqXHR.status;
                    }
                    reject(error);
                })
            });
        };

        this.post = function () {
            return this.wrap($.post.apply(null, arguments));
        };
        this.get = function () {
            return this.wrap($.getJSON.apply(null, arguments));
        };
        this.ajax = function () {
            return this.wrap($.ajax.apply(null, arguments));
        };
    };
    var success_wrapper = new Wrapper('success');
    return {
        /** Wraps $.ajax with an ES6/Bluebird Promise */
        Ajax: function () {

            return success_wrapper.ajax.apply(success_wrapper, arguments);
        },
        /** Wraps $.post with an ES6/Bluebird Promise */
        Post: function () {
            return success_wrapper.post.apply(success_wrapper, arguments);
        },
        /** Wraps $.getJSON with an ES6/Bluebird Promise */
        Get: function () {
            return success_wrapper.get.apply(success_wrapper, arguments);
        },
        /** Poll a celery task. The promise resolves when the task succeeds, or is rejected if the task
         * fails or some other error occurs during polling.
         *
         * @param task_id ID of the celery task to poll
         * @param {Object} [options={}] dictionary of polling options
         * @param {Number} [options.milliseconds=1000] duration to wait between polls
         * @param {Function} [options.on_bad_request=null]
         *     If set, this function is called if the poll request itself fails. This is distinct from the
         *     task itself failing
         * @param {Number} [options.max_bad_requests=5]
         *     The maximum number of times that the on_bad_request function will be called before
         *     aborting the polling.
         * @returns {Promise}
         */
        PollTask: function PollTask(task_id, options) {
            var opts = _.defaults(options || {}, {
                milliseconds: 1000,
                on_bad_request: null,
                max_bad_requests: 5
            });
            var warning_count = 0;
            function poll_task(task_id) {
                return Ajax.Get('/ide/task/' + task_id).then(function(data) {
                    if (data.state.status == 'SUCCESS') {
                        return data.state.result;
                    }
                    else if (data.state.status == 'FAILURE') {
                        var err = new Error(data.state.result);
                        err.task_id = task_id;
                        throw err;
                    }
                    else return Promise.delay(opts.milliseconds).then(function() {
                        return poll_task(task_id);
                    });
                }).catch(function(error) {
                    // If a 'warning' function is specified, call it in one of two cases
                    // 1. The GET request itself fails
                    // 2. The GET request succeeded but the server returns success=False.
                    if (!error.task_id && _.isFunction(opts.on_bad_request) && warning_count < opts.max_bad_requests) {
                        warning_count += 1;
                        opts.on_bad_request(error);
                        return poll_task(task_id);
                    }
                    else {
                        throw error;
                    }
                });
            }
            return poll_task(task_id);
        },
        Wrapper: Wrapper
    }
})();

