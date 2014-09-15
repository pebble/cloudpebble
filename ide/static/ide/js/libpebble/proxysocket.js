(function() {
    var PROXY_SERVER = "wss://ws-proxy.getpebble.com/tool";

    window.PebbleProxySocket = function(token) {
        var self = this;
        var mToken = token;
        var mSocket = null;
        var mConnected = false;
        var mIsConnected = false;
        var mIsAuthenticated = false;

        _.extend(this, Backbone.Events);

        this.connect = function() {
            mSocket = new WebSocket(PROXY_SERVER);
            mSocket.binaryType = "arraybuffer";
            mSocket.onerror = handle_socket_error;
            mSocket.onerror = handle_socket_close;
            mSocket.onmessage = handle_socket_message;
            mSocket.onopen = handle_socket_open;
        };

        this.close = function() {
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
            self.trigger('error', e);
        }

        function handle_socket_open(e) {
            mSocket.send(new Uint8Array([0x09, mToken.length].concat(_.invoke(mToken, 'charCodeAt', 0))));
        }

        function handle_socket_message(e) {
            var data = new Uint8Array(e.data);
            if(data[0] == 0x09) {
                if(data[1] == 0x00) {
                    mIsAuthenticated = true;
                } else {
                    self.trigger('error', "Proxy rejected authentication token.");
                }
            } else if(data[0] == 0x08) {
                if(data[1] == 0xFF) {
                    mIsConnected = true;
                    self.trigger('open');
                } else if(data[1] == 0x00) {
                    self.trigger('close', {wasClean: true});
                }
            }
        }

        function handle_socket_close(e) {
            self.trigger('close', e);
            cleanup();
        }
    }
})();
