(function() {
    /**
     * A registry of things. Used to generate lists and instantiate said things.
     * @constructor
     */
    IB.Registry = function() {
        this.knownClasses = Object.create(null);
    };
    IB.Registry.prototype = {
        /**
         * Registers a new layer type. Should be called at Layer definition time.
         * @param {*} cls
         */
        register: function(cls) {
            this.knownClasses[cls.className] = cls;
        },
        /**
         * Returns a layer class given its name
         * @param {string} className
         * @returns {IB.Layer}
         */
        getClass: function(className) {
            return this.knownClasses[className];
        }
    };

    IB.layerRegistry = new IB.Registry();
    IB.resourceRegistry = new IB.Registry();
})();
