Pebble = function(token) {
    var self = this;
    var mToken = token;
    var mSocket;
    var mAppLogEnabled = false;
    var mHasConnected = false;
    var mIncomingImage = null;

    _.extend(this, Backbone.Events);

    var init = function() {
        mSocket = new PebbleProxySocket(mToken);
        mSocket.on('error', handle_socket_error);
        mSocket.on('close', handle_socket_close);
        mSocket.on('open', handle_socket_open);
        mSocket.on('message', handle_socket_message);
        mSocket.on('all', handle_proxysocket_event); // special message
        console.log("Starting connection");
        mSocket.connect();
    };

    this.ping = function() {
        send_message("PING", pack("bL", [0, 0xDEADBEEF]));
    };

    this.install_app = function(url) {
        console.log("Starting install process.");
        var request = new XMLHttpRequest();
        request.open('get', url, true);
        request.responseType = "arraybuffer";
        request.onload = function(event) {
            var buffer = request.response;
            if(buffer) {
                buffer = new Uint8Array(buffer);
                var final_buffer = new Uint8Array(buffer.length + 1);
                final_buffer.set(buffer, 1);
                final_buffer.set([4]);
                mSocket.send(final_buffer);
                console.log("Sent install message.");
            }
        };
        request.send();
    };

    this.enable_app_logs = function() {
        enable_app_logs();
    };

    this.disable_app_logs = function() {
        disable_app_logs();
    };

    this.close = function() {
        try {
            disable_app_logs();
        } catch(e) {
            // pass.
        }
        if(mSocket)
            mSocket.close();
        mSocket = null;
    };

    this.is_connected = function() {
        return mSocket && mSocket.isOpen();
    };

    var enable_app_logs = function() {
        if(!mAppLogEnabled) {
            console.log("Enabling app logs.");
            send_message("APP_LOGS", [1]);
            mAppLogEnabled = true;
        }
    };

    var disable_app_logs = function() {
        if(mAppLogEnabled) {
            console.log("Disabling app logs.");
            send_message("APP_LOGS", [0]);
            mAppLogEnabled = false;
        }
    };

    var handle_socket_error = function(e) {
        console.log("Socket error: " + e);
        self.trigger('error', e);
        ga('send', 'event', 'phone-error');
    };

    var handle_socket_open = function(e) {
        console.log("Socket open");
        mHasConnected = true;
        ga('send', 'event', 'phone-connect', 'success');
        self.trigger('open');
    };

    var handle_socket_close = function(e) {
        console.log("Socked closed.");
        if(!e.wasClean) {
            console.log("Close was unexpected.");
            if(!mHasConnected) {
                self.trigger("error", "Connection to the phone failed. Check the IP and that developer mode is active.");
                ga('send', 'event', 'phone-connect', 'failed');
            } else {
                self.trigger("error", "Connection to the phone was interrupted.");
                ga('send', 'event', 'phone-disconnect', 'dirty');
            }
        } else {
            ga('send', 'event', 'phone-disconnect', 'clean');
        }
        self.trigger('close');
    };

    var handle_socket_message = function(data) {
        console.log(hexify(data));
        var origin = data[0];
        if(origin == 5) {
            var result = unpack("I", data.subarray(1, 5));
            console.log("Received status update: ", result);
            self.trigger("status", result[0]);
            return;
        } else if(origin == 2) {
            var phone_log = decoder.decode(data.subarray(1));
            self.trigger('phone_log', phone_log);
        }
        if(origin !== 0) return;
        var parts = unpack("HH", data.subarray(1, 5));
        var command = parts[1];
        var size = parts[0];
        var message = data.subarray(5);
        if(command == ENDPOINTS.APP_LOGS) {
            handle_app_log(message);
        } else if(command == ENDPOINTS.SCREENSHOT) {
            handle_screenshot(message);
        } else if(command == ENDPOINTS.VERSION) {
            handle_version(message);
        } else if(command == ENDPOINTS.FACTORY_SETTINGS) {
            handle_factory_setting(message);
        }
    };

    var handle_proxysocket_event = function(event) {
        if(event.substr(0, 6) == "proxy:") {
            self.trigger(event);
        }
    };

    var handle_app_log = function(data) {
        console.log("Received app log.");
        var decoder = new TextDecoder('utf-8');
        var metadata = unpack("IBBH", data.subarray(16, 24));
        var filename = decoder.decode(data.subarray(24, 40));
        var message = decoder.decode(data.subarray(40, 40+metadata[2]));
        var level = metadata[1];
        var line = metadata[3];
        self.trigger("app_log", level, filename, line, message);
    };

    var string_to_bytes = function(string) {
        var bytes = [];
        for(var i = 0; i < string.length; ++i) {
            bytes.push(string.charCodeAt(i));
        }
        return bytes;
    }

    this.request_version = function() {
        console.log("Requesting watch version.");
        send_message('VERSION', pack("B", 0x00));
    };

    var hexify = function(list) {
        var result = '';
        _.each(list, function(number) {
            var hex = number.toString(16);
            while(hex.length < 2) hex = '0' + hex;
            result += hex;
        });
        return result;
    };

    var handle_version = function(message) {
        console.log("Received watch version.");
        result = unpack("BIS32S8BBBIS32S8BBBIS9S12BBBBBBIIS16", message);
        if(result[0] != 1) return;
        self.trigger('version', {
            running: {
                timestamp: result[1],
                version: result[2],
                git: result[3],
                is_recovery: !!result[4],
                platform_version: result[5],
                metadata_version: result[6]
            },
            recovery: {
                timestamp: result[7],
                version: result[8],
                git: result[9],
                is_recovery: !!result[10],
                platform_version: result[11],
                metadata_version: result[12]
            },
            bootloader_version: result[13],
            board_revision: result[14],
            serial_number: result[15],
            device_address: hexify(result.slice(16, 22).reverse()),
            resources: {
                crc: result[22],
                timestamp: result[23],
                XXXXXXXXXXXXXXX: result[24]
            }
        });
    };

    var request_factory_setting = function(key) {
        console.log("Requesting factory settings.");
        send_message('FACTORY_SETTINGS', pack('BB', [0x00, key.length]).concat(string_to_bytes(key)));
    };

    this.request_colour = function() {
        console.log("Requesting colour");
        request_factory_setting('mfg_color');

        var colour_mapping = {
            1: 'tintin-black',
            2: 'tintin-white',
            3: 'tintin-red',
            4: 'tintin-orange',
            5: 'tintin-grey',
            6: 'bianca-silver',
            7: 'bianca-black',
            8: 'tintin-blue',
            9: 'tintin-green',
            10: 'tintin-pink'
        };

        var handle_colour = function(data) {
            self.off('factory_setting:result', handle_colour);
            var colour_id = unpack('I', data)[0];
            var colour_name = colour_mapping[colour_id] || 'unknown';
            self.trigger('colour', colour_name);
        };

        var handle_failure = function() {
            self.off('factory_setting:error', handle_failure);
            console.log("The attached watch has no concept of colour! So, red.");
            self.trigger('colour', 'tintin-red');
        };

        self.on('factory_setting:result', handle_colour);
        self.on('factory_setting:error', handle_failure);
    };


    var handle_factory_setting = function(data) {
        console.log("Received factory settings.");
        if(data.length < 2) {
            self.trigger('factory_setting:error');
            return;
        }
        var result = unpack('BB', data);
        var command_id = result[0];
        if(command_id == 0x01) {
            var strlen = result[1];
            var value = data.subarray(2, 2 + strlen);
            self.trigger('factory_setting:result', value);
        }
    }

    this.request_screenshot = function() {
        console.log("Requesting screenshot.");
        if(mIncomingImage !== null) {
            self.trigger('screenshot:error', "Cannot take a screenshot while a previous screenshot is processing.");
            return;
        }
        send_message("SCREENSHOT", "\x00");
    };

    var handle_screenshot = function(data) {
        console.log("Received screenshot fragment.");
        if(mIncomingImage === null) {
            data = read_screenshot_header(data);
            if(data === null) {
                mIncomingImage = null;
                return;
            }
        }
        mIncomingImage.data.set(data, mIncomingImage.received);
        mIncomingImage.received += data.length;
        self.trigger('screenshot:progress', mIncomingImage.received, mIncomingImage.length);
        if(mIncomingImage.received >= mIncomingImage.length) {
            self.trigger('screenshot:complete', decode_image(mIncomingImage));
            mIncomingImage = null;
        }
    }

    var decode_image = function(incoming_image) {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(incoming_image.width));
        canvas.setAttribute('height', String(incoming_image.height));
        var context = canvas.getContext('2d');

        var image_data = context.createImageData(incoming_image.width, incoming_image.height);

        var expanded_data = new Uint8Array(incoming_image.width * incoming_image.height * 4);
        for(var i = 0; i < incoming_image.data.length; ++i) {
            for(var j = 0; j < 8; ++j) {
                var pixel = (incoming_image.data[i] >> j) & 1;
                var colour = pixel * 255;
                var pos = ((i*8)+j)*4;
                expanded_data[pos+0] = colour;
                expanded_data[pos+1] = colour;
                expanded_data[pos+2] = colour;
                expanded_data[pos+3] = 255; // always fully opaque.
            }
        }

        image_data.data.set(expanded_data);
        context.putImageData(image_data, 0, 0);
        var image = document.createElement('img');
        image.src = canvas.toDataURL();
        return image;
    }

    var read_screenshot_header = function(data) {
        var header_data = unpack("BIII", data.subarray(0, 13));
        var data = data.subarray(13);
        var response_code = header_data[0];
        var version = header_data[1];
        var width = header_data[2];
        var height = header_data[3];
        if(response_code !== 0) {
            self.trigger('screenshot:failed', "Internal watch error.");
            data = null;
        }
        if(version !== 1) {
            self.trigger('screenshot:failed', "Unrecognised image format.");
            data = null;
        }
        mIncomingImage = {
            data: new Uint8Array(width*height / 8),
            version: version,
            width: width,
            height: height,
            length: width * height / 8,
            received: 0
        };
        return data;
    }

    var ENDPOINTS = {
        "TIME": 11,
        "VERSION": 16,
        "PHONE_VERSION": 17,
        "SYSTEM_MESSAGE": 18,
        "MUSIC_CONTROL": 32,
        "PHONE_CONTROL": 33,
        "APPLICATION_MESSAGE": 48,
        "LAUNCHER": 49,
        "LOGS": 2000,
        "PING": 2001,
        "LOG_DUMP": 2002,
        "RESET": 2003,
        "APP": 2004,
        "APP_LOGS": 2006,
        "NOTIFICATION": 3000,
        "RESOURCE": 4000,
        "FACTORY_SETTINGS": 5001,
        "APP_MANAGER": 6000,
        "SCREENSHOT": 8000,
        "PUTBYTES": 48879
    };

    var send_message = function(endpoint, message) {
        console.log("Sending message to " + endpoint + "(" + ENDPOINTS[endpoint] + ")");
        var data = new Uint8Array([1].concat(build_message(ENDPOINTS[endpoint], message)));
        if(!mSocket.isOpen()) {
            throw new Error("Cannot send on non-open socket.");
        }
        mSocket.send(data);
    };

    var build_message = function(endpoint, data) {
        return pack('HH', [data.length, endpoint]).concat(data);
    };

    // Handy utility function to pack data.
    var pack = function(format, data) {
        var pointer = 0;
        var bytes = [];
        for(var i = 0; i < format.length; ++i) {
            if(pointer >= data.length) {
                throw new Error("Expected more data.");
            }
            var chr = format.charAt(i);
            switch(chr) {
            case "b":
            case "B":
                bytes.push(data[pointer++]);
                break;
            case "h":
            case "H":
                bytes.push((data[pointer] >> 8) & 0xFF);
                bytes.push(data[pointer] & 0xFF);
                ++pointer;
                break;
            case "l":
            case "L":
                bytes.push((data[pointer] >> 24) & 0xFF);
                bytes.push((data[pointer] >> 16) & 0xFF);
                bytes.push((data[pointer] >> 8) & 0xFF);
                bytes.push(data[pointer] & 0xFF);
                ++pointer;
                break;
            }
        }
        return bytes;
    };

    var unpack = function(format, bytes) {
        var pointer = 0;
        var data = [];
        var decoder = new TextDecoder('utf-8');
        for(var i = 0; i < format.length; ++i) {
            if(pointer >= bytes.length) {
                throw new Error("Expected more bytes");
            }
            var chr = format.charAt(i);
            switch(chr) {
            case "b":
            case "B":
                data.push(bytes[pointer++]);
                break;
            case "h":
            case "H":
                data.push((bytes[pointer] << 8) | bytes[pointer+1]);
                pointer += 2;
                break;
            case "l":
            case "L":
            case "i":
            case "I":
                data.push((bytes[pointer] << 24) | (bytes[pointer+1] << 16) | (bytes[pointer+2] << 8) | bytes[pointer+3]);
                pointer += 4;
                break;
            case "S":
                var len = '';
                while(format.charAt(i+1).match(/\d/)) {
                    len += format.charAt(++i);
                }
                len = parseInt(len, 10);
                var start = pointer;
                var end = pointer + len;
                while(pointer < end) {
                    if(bytes[pointer] === 0) break; // assume null-terminated strings.
                    ++pointer;
                }
                var stop = pointer;
                var stringBytes = bytes.subarray(start, stop);
                var output = decoder.decode(stringBytes);
                pointer = end;
                data.push(output);
                break;
            }
        }
        return data;
    };

    init();
};
