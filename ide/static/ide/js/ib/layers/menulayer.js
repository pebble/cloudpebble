(function() {
    /**
     * Represents a MenuLayer. This is pretty boring because MenuLayers are configured
     * entirely by callbacks that we can't really provide without defeating the point.
     * @param {IB.Canvas} canvas
     * @param {string} id
     * @constructor
     * @extends {IB.Layer}
     */
    IB.MenuLayer = function(canvas, id) {
        IB.Layer.call(this, canvas, id);
        this.setSize(144, canvas.isFullscreen() ? 168 : 152);
        this.setPos(0, 0);
    };
    IB.MenuLayer.prototype = Object.create(IB.Layer.prototype);
    IB.MenuLayer.prototype.constructor = IB.MenuLayer;
    IB.MenuLayer.className = 'MenuLayer';
    IB.MenuLayer.description = gettext('A menu that pulls its content from programmatic callbacks.');
    _.extend(IB.MenuLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.addClass('ib-menulayer');
        },
        generateInitialiser: function() {
            return [
                this._ID + " = menu_layer_create(" + this.generateRect() + ");",
                "menu_layer_set_click_config_onto_window(" + this._ID + ", s_window);"
            ];
        },
        generateDestructor: function() {
            return ["menu_layer_destroy(" + this._ID + ");"];
        }
    });

    IB.layerRegistry.register(IB.MenuLayer);
})();
