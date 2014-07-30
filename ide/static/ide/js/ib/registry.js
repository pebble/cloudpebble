(function() {
    /**
     * A registry of known UI elements. Used to generate lists and instantiate elements.
     * @constructor
     */
    IB.Registry = function() {
        this.knownLayers = Object.create(null);
    };
    IB.Registry.prototype = {
        /**
         * Registers a new layer type. Should be called at Layer definition time.
         * @param {IB.Layer} layer
         */
        register: function(layer) {
            this.knownLayers[layer.layerClass] = layer;
        },
        /**
         * Returns a layer class given its name
         * @param {string} layerClass
         * @returns {IB.Layer}
         */
        getLayerClass: function(layerClass) {
            return this.knownLayers[layerClass];
        }
    };

    IB.registry = new IB.Registry();
})();
