var CloudPebble = CloudPebble || {};
(function() {
    CloudPebble.Analytics = new (function() {
        var self = this;

        this.addEvent = function(event, data, device) {
            var params = {event: event};
            if(data) {
                params.data = JSON.stringify(data);
            }
            if(device) {
                params.device = JSON.stringify(device);
            }
            $.post('/ide/project/' + PROJECT_ID + '/analytics', params);
        }
    })();
})();
