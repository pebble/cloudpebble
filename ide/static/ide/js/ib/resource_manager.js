(function() {
    IB.ResourceManager = function() {
        /**
         * Mapping of resources.
         * @type {Object.<string, {refcount: number, resource: IB.Resources.Resource}>}
         * @private
         */
        this._resources = Object.create(null);
    };
    IB.ResourceManager.prototype = {
        constructor: IB.ResourceManager,
        addResource: function(kind, id) {
            if(id == '') {
                return;
            }
            if(!(id in this._resources)) {
                var cls = IB.resourceRegistry.getClass(kind);
                var args = _.tail(arguments);
                // This magic lets us create an object by calling its constructor with an array of arguments.
                function F() {
                    cls.apply(this, args);
                }
                F.prototype = cls.prototype;
                this._resources[id] = {refcount: 1, resource: new F()};
            } else {
                ++this._resources[id].refcount;
            }
            return this._resources[id].resource;
        },
        removeResource: function(id) {
            if(!(id in this._resources)) {
                throw new Error("Tried removing a resource that was not added.");
            }
            if(--this._resources[id].refcount == 0) {
                delete this._resources[id];
            }
        },
        getResource: function(id) {
            if(id in this._resources) {
                return this._resources[id].resource;
            }
            return null;
        }
    };
    _.each(['Declaration', 'Initialiser', 'Destructor'], function(it) {
        IB.ResourceManager.prototype['generate' + it] = function() {
            return _.flatten(_.invoke(_.pluck(this._resources, 'resource'), 'generate' + it));
        };
    });
})();
