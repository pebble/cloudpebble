(function() {
    IB.Registry = function() {
        this.knownLayers = Object.create(null);
    };
    IB.Registry.prototype = {
        register: function(layer) {
            this.knownLayers[layer.layerClass] = layer;
        }
    };

    IB.registry = new IB.Registry();
})();
