/**
 * Created by katharine on 1/15/15.
 */

CloudPebble.Emulator = new (function() {
    var self = this;
    this.element = null;
    setDefaults();

    function handleShown(e) {
        var popup = $('.emulator-config');
        popup.find('.emu-app-config').click(doAppConfig);
        popup.find('.emu-shut-down').click(doShutdown);
        popup.find('.emu-sensors').click(doSensors);
        popup.find('.battery-level').on('input', setBatteryState).val(self._batteryLevel);
        popup.find('#is-charging').change(setBatteryState).prop('checked', self._charging);
        popup.find('#bluetooth-enabled').change(setBluetoothState).prop('checked', self._bluetooth);
        popup.find('#24h-enabled').change(set24HState).prop('checked', self._24h);
        popup.find('#peek-showing').change(setTimelinePeek).prop('checked', self._timelinePeek);
    }

    function setDefaults() {
        self._batteryLevel = 80;
        self._charging = false;
        self._bluetooth = true;
        self._24h = true;
        self._timelinePeek = false;
    }

    function handleClosed() {
        setDefaults();
        self.element.popover('hide');
    }

    function getHTML() {
        return '<form class="emulator-config form-horizontal form-popover" style="width: 308px;">' +
            '<div class="control-group">' +
                '<label class="control-label">Battery:</label>' +
                '<div class="controls"><input class="battery-level" type="range" min="0" max="100" step="10" value="80"></div>' +
            '</div>' +
            '<div class="control-group">' +
                '<label class-"control-label" for="is-charging">Charging:</label>' +
                '<div class="controls"><input type="checkbox" id="is-charging" checked></div>' +
            '</div>' +
            '<div class="control-group">' +
                '<label class="control-label" for="bluetooth-enabled">Bluetooth:</label>' +
                '<div class="controls"><input type="checkbox" id="bluetooth-enabled" checked></div>' +
            '</div>' +
            '<div class="control-group">' +
                '<label class="control-label" for="24h-enabled">24-hour:</label>' +
                '<div class="controls"><input type="checkbox" id="24h-enabled" checked></div>' +
            '</div>' +
            '<div class="control-group">' +
                '<label class="control-label" for="peek-showing">Quick View:</label>' +
                '<div class="controls"><input type="checkbox" id="peek-showing"></div>' +
            '</div>' +
            '<button class="btn emu-app-config">App Config</button> ' +
            '<button class="btn emu-sensors">Sensors</button> ' +
            '<button class="btn btn-danger emu-shut-down">Shut down</button>' +
            '</form>';
    }

    function doAppConfig(e) {
        e.preventDefault();
        if(SharedPebble.isVirtual()) {
            SharedPebble.getPebble(ConnectionType.Qemu).then(function(pebble) {
                pebble.request_config_page();
            });
        }
        self.element.popover('hide');
    }

    function doShutdown(e) {
        e.preventDefault();
        SharedPebble.disconnect(true);
        self.element.popover('hide');
        handleClosed();
    }

    function setBatteryState(e) {
        self._batteryLevel = parseInt($('.emulator-config .battery-level').val(), 10);
        self._charging = $('.emulator-config #is-charging').prop('checked');
        SharedPebble.getPebbleNow().emu_set_battery_state(self._batteryLevel, self._charging);
    }

    function setBluetoothState(e) {
        self._bluetooth = $('.emulator-config #bluetooth-enabled').prop('checked');
        SharedPebble.getPebbleNow().emu_bluetooth(self._bluetooth);
    }

    function set24HState(e) {
        self._24h = $('.emulator-config #24h-enabled').prop('checked');
        SharedPebble.getPebbleNow().emu_set_24h(self._24h);
    }

    function setTimelinePeek(e) {
        self._timelinePeek = $('.emulator-config #peek-showing').prop('checked');
        SharedPebble.getPebbleNow().emu_set_peek(self._timelinePeek);
    }

    function doSensors(e) {
        e.preventDefault();
        var prompt = $('#qemu-sensor-prompt').modal('show');
        var token_holder = prompt.find('.cpbl-token').text('…');
        SharedPebble.getEmulator(ConnectionType.Qemu).then(function(emulator) {
            return Ajax.Post('/ide/emulator/' + emulator.getUUID() + '/mobile_token', {
                token: emulator.getToken(),
                url: emulator.getWebsocketURL()
            })
        }).then(function(result) {
            token_holder.text(result.token);
        });
        self.element.popover('hide');
    }

    this.init = function() {
        self.element = $('#emulator-container .configure').popover({
            placement: 'right',
            trigger: 'click',
            content: getHTML,
            html: true,
            animation: false
        }).on('shown', handleShown);
        SharedPebble.on('close', handleClosed);
    };
})();
