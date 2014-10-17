(function() {
    /**
     * Creates a generic layer.
     * @param {IB.Canvas} canvas The canvas we're going to stick the thing into.
     * @param {string} [id] The ID of the layer (to be used as a C identifier)
     * @constructor
     * @extends {Backbone.Events}
     */
    IB.Layer = function(canvas, id) {
        _.extend(this, Backbone.Events);
        this._canvas = canvas;
        this._ID = id;
        this._node = $('<div class="ib-layer">')
                        .data('object', this) // reference cycles? pfft.
                        .css({
                            position: 'absolute'
                        });
        this._properties = {
            pos: new IB.Properties.Pos(gettext("Position"), new IB.Pos(20, 20)),
            size: new IB.Properties.Size(gettext("Size"), new IB.Size(40, 40)),
            id: new IB.Properties.Text(gettext("ID"), this._ID, false)
        };
        this._size = this._properties.size;
        this._pos = this._properties.pos;
        this._properties.id.on('change', _.bind(function(value) {
            if(value == '' || (this._canvas && !this._canvas.isLayerNameAvailable(value))) {
                this._properties.id.setValue(this._ID);
                return;
            }
            var oldID = this._ID;
            this._ID = value;
            this.trigger('changeID', oldID, this._ID);
        }, this));
        this._propListener(this._size, 'resize');
        this._propListener(this._pos, 'reposition');

        this.on('all', this.render, this);
    };
    IB.Layer.className = 'Layer';
    IB.Layer.description = "The basic layer. Invisible unless drawing callbacks are set up programatically.";
    IB.Layer.prototype = {
        /**
         * Generates a C declaration for the layer.
         * @returns {string[]} C code
         */
        generateDeclaration: function() {
            return ["static " + this.constructor.className + " *" + this._ID + ";"];
        },

        /**
         * Generates a GRect indicating the frame of the layer
         * @returns {string[]} C code
         */
        generateRect: function() {
            var size = this._size.getValue();
            var pos = this._pos.getValue();
            return ["GRect(" + pos.x + ", " + pos.y + ", " + size.w + ", " + size.h + ")"];
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
            return _.clone(this._size.getValue());
        },

        /**
         * Sets the size of the layer.
         * @param {Number} w - layer width
         * @param {Number} h - layer height
         */
        setSize: function(w, h) {
            this._size.setValue(new IB.Size(w, h));
        },

        /**
         * Returns the position of the layer.
         * @returns {IB.Pos}
         */
        getPos: function() {
            return _.clone(this._pos.getValue());
        },

        /**
         * Sets the position of the layer.
         * @param {Number} x
         * @param {Number} y
         */
        setPos: function(x, y) {
            this._pos.setValue(new IB.Pos(x, y));
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
                height: this._size.getValue().h,
                width: this._size.getValue().w,
                top: this._pos.getValue().y,
                left: this._pos.getValue().x
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
        },
        /**
         * Destroys the layer.
         */
        destroy: function() {
            this._node.remove();
            _.invoke(this._properties, 'destroy');
            this.trigger('destroy', this);
        },
        /**
         * Returns the name of the layer's type (e.g. BitmapLayer)
         * @returns {string}
         */
        getTypeName: function() {
            return this.constructor.className;
        },
        deleteLayer: function() {
            this._canvas.deleteLayer(this);
        },
        /**
         * Adds a listener to a property's change event that triggers an event on the layer.
         * @param prop
         * @param event
         * @private
         */
        _propListener: function(prop, event) {
            prop.on('change', function(value) {
                this.trigger(event, value);
            }, this);
        },
        constructor: IB.Layer
    };

    IB.layerRegistry.register(IB.Layer);
})();
