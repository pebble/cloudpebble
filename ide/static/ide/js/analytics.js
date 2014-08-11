var CloudPebble = CloudPebble || {};
(function() {
    CloudPebble.Analytics = new (function() {
        var self = this;

        this.addEvent = function(event, data, device, collections) {
            var params = {event: event};
            if(data) {
                params.data = JSON.stringify(data);
            }
            if(device) {
                params.device = JSON.stringify(device);
            }
            if(collections) {
                params.collections = JSON.stringify(collections);
            }
            $.post('/ide/project/' + PROJECT_ID + '/analytics', params);
        }
    })();
})();
