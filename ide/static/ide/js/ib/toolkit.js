(function() {
    /**
     * Toolkit view that shows available elements in the given parent node, and adds them to the given canvas.
     * @param parent
     * @param canvas
     * @constructor
     */
    IB.Toolkit = function(parent, canvas) {
        this._parent = parent;
        this._canvas = canvas;
        this._listNode = null;
    };
    IB.Toolkit.prototype = {
        /**
         * Renders the list into the parent node.
         */
        renderList: function() {
            if(!this._listNode) {
                this._listNode = $('<table class="ib-toolkit">')
                    .appendTo(this._parent);
            }
            var list = this._listNode;
            list.empty();
            _.each(IB.layerRegistry.knownClasses, function(layer, name) {
                var li = $('<tr>')
                    .append($('<td class="name">').text(name))
                    .append($('<td class="desc">').text(layer.description))
                    .click(_.bind(this._createLayer, this, layer))
                    .appendTo(list);
            }, this);
        },
        /**
         * Creates an instance of the given layer class and adds it to the canvas.
         * @param {IB.Layer} layerClass The type of layer to create.
         * @private
         */
        _createLayer: function(layerClass) {
            var layer = new layerClass(this._canvas, this._canvas.findNameForLayerType(layerClass.className));
            this._canvas.addLayer(layer);
            this._canvas.selectLayer(layer);
            CloudPebble.Analytics.addEvent("cloudpebble_ib_created_layer", {layer_type: layerClass.className}, null, ['cloudpebble']);
        }
    };
})();
