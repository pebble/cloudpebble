(function() {
    var sLayerCounter = 0;
    /**
     * Creates a generic layer.
     * @param {string} [id] The ID of the layer (to be used as a C identifier)
     * @constructor
     * @extends {Backbone.Events}
     */
    IB.Layer = function(id) {
        _.extend(this, Backbone.Events);
        this._pos = new IB.Pos(20, 20);
        this._size = new IB.Size(40, 40);
        this._ID = id || ("s_layer_" + ++sLayerCounter);
        this._node = $('<div class="ib-layer">')
                        .data('object', this) // reference cycles? pfft.
                        .css({
                            position: 'absolute'
                        });
        this._properties = {
            x: new IB.Properties.Int("X Position", this._pos.x, -32768, 32767),
            y: new IB.Properties.Int("Y Position", this._pos.y, -32768, 32767),
            w: new IB.Properties.Int("Width", this._size.w, 0, 32767),
            h: new IB.Properties.Int("Height", this._size.h, 0, 32767),
            id: new IB.Properties.Text("ID", this._ID)
        };
        this._properties.x.on('change', _.bind(function(value) {
            this.setPos(value, this._pos.y);
        }, this));
        this._properties.y.on('change', _.bind(function(value) {
            this.setPos(this._pos.x, value);
        }, this));
        this._properties.w.on('change', _.bind(function(value) {
            this.setSize(value, this._size.h);
        }, this));
        this._properties.h.on('change', _.bind(function(value) {
            this.setSize(this._size.w, value);
        }, this));
        this._properties.id.on('change', _.bind(function(value) {
            this._ID = value;
        }, this));

        this.on('all', this.render, this);
    };
    IB.Layer.layerClass = 'Layer';
    IB.Layer.prototype = {
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
            if(this._size.w == w && this._size.h == h) {
                return;
            }
            this._size = new IB.Size(w, h);
            this._properties.w.setValue(this._size.w);
            this._properties.h.setValue(this._size.h);
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
            if(this._pos.x == x && this._pos.y == y) {
                return;
            }
            this._pos = new IB.Pos(x, y);
            this._properties.x.setValue(this._pos.x);
            this._properties.y.setValue(this._pos.y);
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
        },

        /**
         * A reference to the properties.
         * @returns {*} Properties
         */
        getProperties: function() {
            return this._properties;
        },

        /**
         * Given some properties, understand things.
         * @param {{fn: string, params: string[]}[]} properties
         */
        readProperties: function(properties) {
            // We don't actually have any properties.
        }
    };
    IB.Layer.setLayerCounter = function(count) {
        sLayerCounter = count;
    };

    IB.registry.register(IB.Layer);
})();
