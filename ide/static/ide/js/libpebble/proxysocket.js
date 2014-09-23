(function() {
    var PROXY_SERVER = LIBPEBBLE_PROXY;

    window.PebbleProxySocket = function(token) {
        var self = this;
        var mToken = token;
        var mSocket = null;
        var mConnected = false;
        var mIsConnected = false;
        var mIsAuthenticated = false;

        _.extend(this, Backbone.Events);

        this.connect = function() {
            if(!PROXY_SERVER) {
                _.defer(function() {
                    self.trigger('error', "Websocket proxy not specified.");
                });
                return;
            }
            mSocket = new WebSocket(PROXY_SERVER);
            mSocket.binaryType = "arraybuffer";
            mSocket.onerror = handle_socket_error;
            mSocket.onerror = handle_socket_close;
            mSocket.onmessage = handle_socket_message;
            mSocket.onopen = handle_socket_open;
            console.log("Connecting to " + PROXY_SERVER);
        };

        this.close = function() {
            mSocket.close();
            cleanup();
        };

        this.send = function(data) {
            console.log("Sending data:", data);
            mSocket.send(data);
        };

        this.isOpen = function() {
            return mIsConnected;
        };

        function cleanup() {
            mSocket = null;
            mIsConnected = false;
            mIsAuthenticated = false;
        }

        function handle_socket_error(e) {
            console.log("socket error", e);
            self.trigger('error', e);
        }

        function handle_socket_open(e) {
            console.log("socket open; authenticating...");
            self.send(new Uint8Array([0x09, mToken.length].concat(_.invoke(mToken, 'charCodeAt', 0))));
        }

        function handle_socket_message(e) {
            var data = new Uint8Array(e.data);
            console.log("Received socket message", data);
            if(data[0] == 0x09) {
                if(data[1] == 0x00) {
                    console.log("Authenticated successfully.");
                    mIsAuthenticated = true;
                } else {
                    console.log("Authentication failed.");
                    self.trigger('error', "Proxy rejected authentication token.");
                }
            } else if(data[0] == 0x08) {
                if(data[1] == 0xFF) {
                    console.log("Connected successfully.");
                    mIsConnected = true;
                    self.trigger('open');
                } else if(data[1] == 0x00) {
                    console.log("Connection closed remotely.");
                    self.trigger('close', {wasClean: true});
                }
            }
        }

        function handle_socket_close(e) {
            console.log("Socket closed.");
            self.trigger('close', e);
            cleanup();
        }
    }
})();
