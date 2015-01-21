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
        popup.find('.battery-level').on('input', setBatteryState).val(self._batteryLevel);
        popup.find('#is-charging').change(setBatteryState).prop('checked', self._charging);
        popup.find('#bluetooth-enabled').change(setBluetoothState).prop('checked', self._bluetooth);
    }

    function setDefaults() {
        self._batteryLevel = 80;
        self._charging = false;
        self._bluetooth = true;
    }

    function handleClosed() {
        setDefaults();
        self.element.popover('hide');
    }

    function getHTML() {
        return '<form class="emulator-config form-horizontal form-popover" style="width: 260px;">' +
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
            '<button class="btn emu-app-config">App Config</button> <button class="btn btn-danger emu-shut-down">Shut down</button>' +
            '</form>';
    }

    function doAppConfig(e) {
        e.preventDefault();
        if(SharedPebble.isVirtual()) {
            SharedPebble.getPebble(true).done(function(pebble) {
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
