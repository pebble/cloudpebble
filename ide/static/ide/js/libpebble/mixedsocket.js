(function() {
    var sPebbleCounter = 0;
    window.PebbleMixedContent = function(ip, port) {
        var self = this;
        var mIP = ip;
        var mPort = port;
        var mInstanceID = sPebbleCounter++;

        // A frame that we can bootstrap.
        var FRAME_SOURCE = "<html><head></head>" +
            "<body>" +
            "<script>" +
            "var gParentWindow = parent;\n" +
            "var gInstanceID = " + mInstanceID + ";\n" +
            "(function() {\n" +
            "   var listener = function(event) {\n" +
            "       window.removeEventListener('message', listener, false);\n" +
            "       gParentWindow = event.source;\n" +
            "       eval(event.data);\n" +
            "   }\n" +
            "   window.addEventListener('message', listener, false);\n" +
            "   gParentWindow.postMessage({from: 'libpebble', event: 'frameloaded', instance: gInstanceID}, '*');\n" +
            "})();\n" +
            "</script>" +
            "</body>" +
            "</html>";

        var mFrame = null;
        var mChildWindow = null;
        var mIsOpen = false;

        _.extend(this, Backbone.Events);

        this.connect = function() {
            $(window).on('message', handleFrameMessage);
            mFrame = $('<iframe>').attr('src', 'data:text/html;base64,' + btoa(FRAME_SOURCE)).appendTo('body');
            mChildWindow = mFrame[0].contentWindow;
        };

        this.close = function() {
            if(mChildWindow) {
                mChildWindow.postMessage({action: 'close'}, '*');
            }
        };

        this.send = function(data) {
            mChildWindow.postMessage({action: 'send', data: _.map(data, _.identity)}, '*');
        };

        this.isOpen = function() {
            return mIsOpen;
        };

        var doBootstrap = function() {
            // It is both terrible and hilarious that this actually works.
            console.log("bootstrapping");
            var script = "(" + INNER_CODE.toString() + ")();";
            mChildWindow.postMessage(script, "*");
        };

        var handleFrameMessage = function(e) {
            console.log("got message");
            var data = e.originalEvent.data; // boo jQuery.
            if(data.from != 'libpebble' || data.instance !== mInstanceID) {
                return;
            }
            if(data.event === 'frameloaded') {
                doBootstrap();
                mChildWindow.postMessage({action: 'connect', ip: mIP, port: mPort}, '*');
                return;
            }
            if(data.event == 'open') {
                mIsOpen = true;
            } else if(data.event == 'close' || data.event == 'error') {
                mIsOpen = false;
                mFrame.remove();
                mFrame = null;
                mChildWindow = null;
                $(window).off('message', handleFrameMessage);
            } else if(data.event == 'message') {
                data.eventData = new Uint8Array(data.eventData);
            } else if(data.event == 'dns_survey') {
                CloudPebble.Analytics.addEvent('cloudpebble_dns_survey', {
                    resolved: data.eventData.resolved,
                    target_ip: mIP
                });
            }
            self.trigger(data.event, data.eventData);
        };
    };

    // This code is only ever run in a completely different context, so cannot assume any libraries.
    // It also can't use things that use libraries - so reusing PebbleWebSocket is out, for instance.
    var INNER_CODE = function() {
        var mSocket = null;
        var mTargetIP = null;
        var mTargetPort = null;
        var mTestingDNS = true;

        // This should be a no-op but makes my editor stop whining about undefined variables.
        if(!window.gParentWindow) {
            window.gParentWindow = null;
        }
        if(!window.gInstanceID) {
            window.gInstanceID = 0;
        }

        function ipToHostname(ip) {
            return 'ip-' + ip.split('.').join('-') + '.ip.pebble-sockets.com';
        }

        function createWebSocket(url) {
            mSocket = new WebSocket(url);
            mSocket.binaryType = "arraybuffer";
            mSocket.onopen = handleOpen;
            mSocket.onclose = handleClose;
            mSocket.onerror = handleError;
            mSocket.onmessage = handleMessage;
        }

        function destroyWebsocket() {
            mSocket.onerror = null;
            mSocket.onclose = null;
            mSocket.onmessage = null;
            mSocket.onopen = null;
            mSocket = null;
        }

        function handleFrameMessage(e) {
            var data = e.data;
            if(data.action == 'connect') {
                mTestingDNS = true;
                mTargetIP = data.ip;
                mTargetPort = data.port;
                createWebSocket('ws://' + ipToHostname(data.ip) + ':' + data.port + '/');
            } else if(data.action == 'send') {
                mSocket.send(new Uint8Array(data.data));
            } else if(data.action == 'close') {
                mSocket.close();
            }
        }

        function sendEvent(event, message, transfer) {
            message = {
                event: event,
                from: 'libpebble',
                eventData: message,
                instance: gInstanceID
            };
            gParentWindow.postMessage(message, '*', transfer);
        }

        function handleOpen() {
            sendEvent('open');
            sendEvent('dns_survey', {resolved: mTestingDNS});
        }

        function handleClose(e) {
            if(!e.wasClean && mTestingDNS) {
                mTestingDNS = false;
                destroyWebsocket();
                createWebSocket('ws://' + mTargetIP + ':' + mTargetPort + '/');
                return;
            }
            sendEvent('close', {wasClean: e.wasClean});
        }

        function handleError(e) {
            if(mTestingDNS) {
                mTestingDNS = false;
                destroyWebsocket();
                createWebSocket('ws://' + mTargetIP + ':' + mTargetPort + '/');
                return;
            }
            var object = {};
            for(var prop in e) {
                // The lack of a hasOwnProperty check here is intentional.
                object[prop] = e[prop];
            }
            sendEvent('error', object);
        }

        function handleMessage(e) {
            var uint8_data = new Uint8Array(e.data);
            // Sending data apparently makes it sad, so we do this ridiculous thing.
            var array_data = Array.prototype.map.call(uint8_data, function(x) { return x; });
            sendEvent('message', array_data);
        }

        window.addEventListener('message', handleFrameMessage);
    };
})();
