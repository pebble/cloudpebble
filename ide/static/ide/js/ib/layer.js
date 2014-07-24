(function() {
    var sLayerCounter = 0;
    /**
     * Creates a generic layer.
     * @param {string} [id] The ID of the layer (to be used as a C identifier)
     * @constructor
     */
    IB.Layer = function(id) {
        _.extend(this, Backbone.Events);
        this._pos = new IB.Pos(20, 20);
        this._size = new IB.Size(40, 40);
        this._ID = id || ("layer_" + ++sLayerCounter);
        this._node = $('<div class="ib-layer">')
                        .data('object', this) // reference cycles? pfft.
                        .css({
                            position: 'absolute'
                        });
        this.init();
    };
    IB.Layer.layerClass = 'Layer';
    IB.Layer.prototype = {
        /**
         * Initialises the layer.
         */
        init: function() {
            return this;
        },

        /**
         * Generates a C declaration for the layer.
         * @returns {string[]} C code
         */
        generateDeclaration: function() {
            return ["static Layer *" + this._ID + ";"];
        },

        /**
         * Generates a GRect indicating the frame of the layer
         * @returns {string[]} C code
         */
        generateRect: function() {
            return ["GRect(" + this._pos.x + ", " + this._pos.y + ", " + this._size.w + ", " + this._size.h + ")"];
        },

        /**
         * Generates an initialiser to create the layer.
         * @returns {string[]} C code
         */
        generateInitialiser: function() {
            return [this._ID + " = layer_create(" + this.generateRect() + ");"];
        },

        /**
         * Generates a destructor for the layer
         * @returns {string[]} C code
         */
        generateDestructor: function() {
            return ["layer_destroy(" + this._ID + ");"];
        },

        /**
         * Returns the size of the layer.
         * @returns {IB.Size}
         */
        getSize: function() {
            return _.clone(this._size);
        },

        /**
         * Sets the size of the layer.
         * @param {Number} w - layer width
         * @param {Number} h - layer height
         */
        setSize: function(w, h) {
            this._size = new IB.Size(w, h);
            this.trigger('size', this.getSize());
        },

        /**
         * Returns the position of the layer.
         * @returns {IB.Pos}
         */
        getPos: function() {
            return _.clone(this._pos);
        },

        /**
         * Sets the position of the layer.
         * @param {Number} x
         * @param {Number} y
         */
        setPos: function(x, y) {
            this._pos = new IB.Pos(x, y);
            this.trigger('position', this.getPos());
        },

        /**
         *
         * @returns {string}
         */
        getID: function() {
            return this._ID;
        },

        /**
         * Renders the layer. Note that it can only be displayed once.
         * @param {jQuery|HTMLElement} [parent] Node to render the layer into.
         */
        render: function(parent) {
            if(parent) {
                this._node.appendTo(parent);
            }
            this._node.css({
                height: this._size.h,
                width: this._size.w,
                top: this._pos.y,
                left: this._pos.x
            });
        }
    };

    IB.registry.register(IB.Layer);
})();
