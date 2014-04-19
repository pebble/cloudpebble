CloudPebble.Documentation = new (function() {
    var mDocumentation = {};

    this.Init = function() {
        $.getJSON(DOC_JSON, function(data) {
            mDocumentation = data;
        });
    };

    this.Lookup = function(name) {
        return mDocumentation[name] || null;
    }
})();
