(function() {
    IB.Toolkit = function(parent, canvas) {
        this._parent = parent;
        this._canvas = canvas;
        this._listNode = null;
    };
    IB.Toolkit.prototype = {
        renderList: function() {
            if(!this._listNode) {
                this._listNode = $('<ul class="ib-toolkit">')
                    .appendTo(this._parent);
            }
            var list = this._listNode;
            list.empty();
            _.each(IB.registry.knownLayers, function(layer, name) {
                var li = $('<li class="ib-toolkit-layer">')
                    .text(name)
                    .click(_.bind(this._createLayer, this, layer))
                    .appendTo(list);
            }, this);
        },
        _createLayer: function(layerClass) {
            var layer = new layerClass();
            this._canvas.addLayer(layer);
            this._canvas.selectLayer(layer);
        }
    };
})();
