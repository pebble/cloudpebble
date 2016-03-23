Ajax = (function() {
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
                        reject(data.error ? new Error(data.error) : new Error(gettext("Unknown error")));
                    }
                    else {
                        resolve(data);
                    }
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    if (textStatus == 'abort') {
                        resolve();
                    }
                    var message;
                    if (jqXHR & jqXHR.responseJSON && jqXHR.responseJSON.error) {
                        message = jqXHR.responseJSON.error;
                    }
                    else {
                        message = errorThrown;
                    }
                    var error = new Error(message);
                    if (jqXHR) {
                        error.jqXHR = jqXHR;
                        error.status = jqXHR.status;
                        error.statusText = jqXHR.statusText;
                    }
                    error.errorThrown = errorThrown;
                    error.textStatus = textStatus;
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
        Wrapper: Wrapper
    }
})();

