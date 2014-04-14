CloudPebble.Documentation = new (function() {
    var mDocumentation = {};

    this.Init = function() {
        $.getJSON('/static/ide/documentation.json', function(data) {
            mDocumentation = data;
        });
    };

    this.Lookup = function(name) {
        return mDocumentation[name] || null;
    }
})();
