Ajax = {
    Wrap: function(deferred) {
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
         */
        return new Promise(function (resolve, reject) {
            deferred.then(function (data) {
                if (_.isObject(data) && !data.success) {
                    reject(data.error ? new Error(data.error) : new Error(gettext("Unknown error")));
                }
                else {
                    resolve(data);
                }
            }).fail(function (jqXHR, textStatus, errorThrown) {
                // TODO: consider subclassing
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
        })
    },

    Ajax: function () {
        /** Wraps $.ajax with an ES6/Bluebird Promise */
        return Ajax.Wrap($.ajax.apply(null, arguments));
    },
    Post: function () {
        /** Wraps $.post with an ES6/Bluebird Promise */
        return Ajax.Wrap($.post.apply(null, arguments));
    },
    Get: function() {
        /** Wraps $.getJSON with an ES6/Bluebird Promise */
        return Ajax.Wrap($.getJSON.apply(null, arguments));
    }
};

