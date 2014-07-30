(function() {
    var BUTTONS = ['up', 'select', 'down'];
    /**
     * Represents an ActionBarLayer (and so cannot be moved or resized)
     * @param {string} [id]
     * @extends {IB.Layer}
     * @constructor
     */
    IB.ActionBarLayer = function(id) {
        IB.Layer.call(this, id);

        _.extend(this._properties, {
            bg: new IB.Properties.Colour("Background", IB.ColourBlack),
            icon_up: new IB.Properties.Bitmap("Top icon", ""),
            icon_select: new IB.Properties.Bitmap("Middle icon", ""),
            icon_down: new IB.Properties.Bitmap("Bottom icon", "")
        });
        this._backgroundColour = this._properties.bg;
        this._propListener(this._backgroundColour, 'backgroundColourChange');
        this._icons = {};
        this._icon_nodes = {};
        _.each(BUTTONS, function(it) {
            this._icons[it] = this._properties['icon_' + it];
            this._icon_nodes[it] = $('<div>')
                .addClass('ib-actionbarlayer-icon ib-icon-' + it)
                .appendTo(this._node);
            this._propListener(this._properties['icon_' + it], it + 'IconChange');
        }, this);

        this.setSize(20, 146);
        this.setPos(124, 3);
        this._size.lock();
        this._pos.lock();
    };
    IB.ActionBarLayer.prototype = Object.create(IB.Layer.prototype);
    IB.ActionBarLayer.constructor = IB.ActionBarLayer;
    IB.ActionBarLayer.layerClass = 'ActionBarLayer';
    _.extend(IB.ActionBarLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.addClass('ib-actionbarlayer');
            this._node.css({
                'background-color': this._backgroundColour.getValue().css
            });
            var invertIcons = (this._backgroundColour.getValue() != IB.ColourWhite);
            _.each(this._icon_nodes, function(node, it) {
                var url = this._icons[it].getBitmapURL();
                node.css({
                    'background-image': url ? 'url(' + url + ')' : '',
                    '-webkit-filter': invertIcons ? 'invert(100%)' : 'none'
                });
            }, this);
        },
        generateDeclaration: function() {
            var decl = ["static ActionBarLayer *" + this._ID + ";"];
            _.each(BUTTONS, function(it) {
                var icon = this._icons[it].getValue();
                if(icon) {
                    decl.push("static GBitmap *" + this._ID + "_icon_" + it + ";");
                }
            }, this);
            return decl;
        },
        generateInitialiser: function() {
            var init = [
                this._ID + " = action_bar_layer_create();",
                "action_bar_layer_add_to_window(" + this._ID + ", s_window);"
            ];
            if(this._backgroundColour != IB.ColourBlack) {
                init.push("action_bar_layer_set_background_color("
                    + this._ID + ", " + this._backgroundColour.getValue().name + ");");
            }
            _.each(BUTTONS, function(it) {
                var icon = this._icons[it].getValue();
                if(icon) {
                    init.push(this._ID + "_icon_" + it
                        + " = gbitmap_create_with_resource(RESOURCE_ID_" + icon + ");");
                    init.push("action_bar_layer_set_icon(" + this._ID
                        + ", BUTTON_ID_" + it.toUpperCase() + ", "
                        + this._ID + "_icon_" + it + ");");
                }
            }, this);
            return init;
        },
        generateDestructor: function() {
            var destroy = [];
            _.each(BUTTONS, function(it) {
                var icon = this._icons[it].getValue();
                if(icon) {
                    destroy.push("gbitmap_destroy(" + this._ID + "_icon_" + it + ");");
                }
            }, this);
            destroy.push("action_bar_layer_destroy(" + this._ID + ");");
            return destroy;
        },
        readProperties: function(properties, mappings) {
            IB.Layer.prototype.readProperties.call(this, properties);
            _.each(properties, function(values, property) {
                switch(property) {
                    case "action_bar_layer_set_background_color":
                        this._backgroundColour.setValue(IB.ColourMap[values[1]]);
                        break;
                    case "action_bar_layer_set_icon":
                        this._icons[values[1].split('_').pop().toLowerCase()].setValue(mappings[values[2]]);
                        break;
                }
            }, this);
        }
    });

    IB.registry.register(IB.ActionBarLayer);
})();
