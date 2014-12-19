(function() {
    window.PebbleProxySocket = function(proxy, token) {
        var self = this;
        var mToken = token;
        var mSocket = null;
        var mIsConnected = false;
        var mIsAuthenticated = false;

        _.extend(this, Backbone.Events);

        this.connect = function() {
            if(!proxy) {
                console.log("No proxy server available.");
                _.defer(function() {
                    self.trigger('error', "Websocket proxy not specified.");
                });
                return;
            }
            mSocket = new WebSocket(proxy);
            mSocket.binaryType = "arraybuffer";
            mSocket.onerror = handle_socket_error;
            mSocket.onerror = handle_socket_close;
            mSocket.onmessage = handle_socket_message;
            mSocket.onopen = handle_socket_open;
            console.log("Connecting to " + proxy);
        };

        this.close = function() {
            if(!mSocket) return;
            mSocket.close();
            cleanup();
        };

        this.send = function(data) {
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
            self.trigger('proxy:authenticating');
            self.send(new Uint8Array([0x09, mToken.length].concat(_.invoke(mToken, 'charCodeAt', 0))));
        }

        function handle_socket_message(e) {
            var data = new Uint8Array(e.data);
            if(data[0] == 0x09) {
                if(data[1] == 0x00) {
                    self.trigger('proxy:waiting');
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
            } else {
                self.trigger('message', data);
            }
        }

        function handle_socket_close(e) {
            console.log("Socket closed.");
            self.trigger('close', e);
            cleanup();
        }
    }
})();
