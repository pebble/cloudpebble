(function() {
    IB.PropertyView = function(parent, layer) {
        this._parent = parent;
        this._layer = layer;
        this._root = $('<div class="form-horizontal">');
    };
    IB.PropertyView.prototype = {
        render: function() {
            // Here we assume bootstrap magic... mostly because it's convenient.
            var groups = _.map(this._layer.getProperties(), this._generateControlGroup);
            this._root.empty().append(groups).appendTo(this._parent);
        },
        destroy: function() {
            _.each(this._layer.getProperties(), function(property) {
                property.getNode().detach();
            });
            this._root.empty();
            this._root = null;
            this._parent = null;
            this._layer = null;
        },
        _generateControlGroup: function(property) {
            return $('<div class="control-group">')
                .append(
                    $('<label class="control-label">')
                        .text(property.getName()))
                .append(
                    $('<div class="controls">')
                        .append(property.getNode()));
        }
    };
})();
