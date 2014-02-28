var CloudPebble = CloudPebble || {};
(function() {
    CloudPebble.Analytics = new (function() {
        var self = this;

        this.addEvent = function(event, data) {
            var params = {event: event};
            if(data) {
                params.data = JSON.stringify(data);
            }
            $.post('/ide/project/' + PROJECT_ID + '/analytics', params);
        }
    })();
})();
