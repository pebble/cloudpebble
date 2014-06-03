var PebbleWebSocket = function(ip, port) {
    var self = this;
    var mIP = ip;
    var mPort = port;
    var mSocket = null;

    _.extend(this, Backbone.Events);

    this.connect = function() {
        mSocket = new WebSocket('ws://' + mIP + ':' + mPort + '/');
        mSocket.binaryType = "arraybuffer";
        mSocket.onerror = handle_socket_error;
        mSocket.onclose = handle_socket_close;
        mSocket.onmessage = handle_socket_message;
        mSocket.onopen = handle_socket_open;
    };

    this.close = function() {
        mSocket.close();
        mSocket = null;
    };

    this.send = function(data) {
        mSocket.send(data);
    };

    this.isOpen = function() {
        return (mSocket.readyState == WebSocket.OPEN);
    };

    var handle_socket_error = function(e) {
        self.trigger('error', e);
    };

    var handle_socket_open = function() {
        self.trigger('open');
    };

    var handle_socket_close = function(e) {
        self.trigger('close', e);
        mSocket = null;
    };

    var handle_socket_message = function(e) {
        self.trigger('message', new Uint8Array(e.data));
    };
};
