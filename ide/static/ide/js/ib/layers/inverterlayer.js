(function() {
    /**
     * Represents an InverterLayer, which inverts anything behind it.
     * @param {IB.Canvas} canvas
     * @param {string} id
     * @constructor
     * @extends {IB.Layer}
     */
    IB.InverterLayer = function(canvas, id) {
        IB.Layer.call(this, canvas, id);
        this._clonedLayers = [];
        this._canvas.on('all', this._handleOtherChange, this);
    };
    IB.InverterLayer.className = 'InverterLayer';
    IB.InverterLayer.prototype = Object.create(IB.Layer.prototype);
    IB.InverterLayer.description = gettext("Inverts the colours of the rectangle behind it. Layers in front are unaffected.");
    _.extend(IB.InverterLayer.prototype, {
        constructor: IB.InverterLayer,
        // Rendering works by duplicating all layers *below* the current layer as children of our node,
        // then inverting them via CSS. We listen to all of them, as well as the canvas itself, so we
        // can update our clone whenever they change.
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.addClass('ib-inverterlayer ib-invert');
            var layers = this._canvas.getLayers();
            _.invoke(this._clonedLayers, 'off', 'all', this._handleOtherChange, this);
            this._clonedLayers = layers.slice(0, _.indexOf(layers, this));
            this._node
                .empty()
                .append(
                    $('<div>')
                        .css({
                            position: 'absolute',
                            width: 144,
                            height: 168,
                            top: -this._pos.getValue().y,
                            left: -this._pos.getValue().x,
                            'background-color': this._canvas.getBackgroundColour().css
                        })
                        .append(_.invoke(_.pluck(this._clonedLayers, '_node'), 'clone'))
                );
            _.invoke(this._clonedLayers, 'on', 'all', this._handleOtherChange, this);
        },
        generateInitialiser: function() {
            return [this._ID + " = inverter_layer_create(" + this.generateRect() + ");"];
        },
        generateDestructor: function() {
            return ["inverter_layer_destroy(" + this._ID + ");"];
        },
        destroy: function() {
            IB.Layer.prototype.destroy.call(this);
            _.invoke(this._clonedLayers, 'off', 'all', this._handleOtherChange, this);
            this._canvas.off('all', this._handleOtherChange);
        },
        _handleOtherChange: function(e) {
            this.render();
        }
    });

    IB.layerRegistry.register(IB.InverterLayer);
})();
