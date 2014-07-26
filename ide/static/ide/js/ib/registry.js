(function() {
    IB.Registry = function() {
        this.knownLayers = Object.create(null);
    };
    IB.Registry.prototype = {
        register: function(layer) {
            this.knownLayers[layer.layerClass] = layer;
        },
        getLayerClass: function(layerClass) {
            return this.knownLayers[layerClass];
        }
    };

    IB.registry = new IB.Registry();
})();
