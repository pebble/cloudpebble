(function() {
    var BUTTONS = ['up', 'select', 'down'];
    /**
     * Represents an ActionBarLayer (and so cannot be moved or resized)
     * @param {IB.Canvas} canvas
     * @param {string} [id]
     * @extends {IB.Layer}
     * @constructor
     */
    IB.ActionBarLayer = function(canvas, id) {
        IB.Layer.call(this, canvas, id);

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
        this._old_icon_ids = {};
        _.each(BUTTONS, function(it) {
            this._icons[it] = this._properties['icon_' + it];
            this._old_icon_ids[it] = '';
            this._icon_nodes[it] = $('<img>').appendTo(
                $('<div>')
                    .addClass('ib-actionbarlayer-icon ib-icon-' + it)
                    .appendTo(this._node));
            this._propListener(this._properties['icon_' + it], it + 'IconChange');
            this._properties['icon_' + it].on('change', _.partial(this._handleIconChange, it), this);
        }, this);

        this.setSize(20, 146);
        this.setPos(124, 3);
        this._size.lock();
        this._pos.lock();
    };
    IB.ActionBarLayer.prototype = Object.create(IB.Layer.prototype);
    IB.ActionBarLayer.prototype.constructor = IB.ActionBarLayer;
    IB.ActionBarLayer.className = 'ActionBarLayer';
    _.extend(IB.ActionBarLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.addClass('ib-actionbarlayer');
            this._node.css({
                'background-color': this._backgroundColour.getValue().css
            });
            var invertIcons = (this._backgroundColour.getValue() != IB.ColourWhite);
            _.each(this._icon_nodes, function(node, it) {
                node.css('-webkit-filter', invertIcons ? 'invert(100%)' : 'none');
                var url = this._icons[it].getBitmapURL();
                if(url) {
                    node.attr('src', url);
                } else {
                    node.removeAttr('src');
                }
            }, this);
        },
        generateDeclaration: function() {
            return ["static ActionBarLayer *" + this._ID + ";"];
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
                    init.push("action_bar_layer_set_icon(" + this._ID
                        + ", BUTTON_ID_" + it.toUpperCase() + ", "
                        + this._canvas.getResources().getResource(icon) + ");");
                }
            }, this);
            return init;
        },
        generateDestructor: function() {
            return ["action_bar_layer_destroy(" + this._ID + ");"];
        },
        readProperties: function(properties, mappings) {
            IB.Layer.prototype.readProperties.call(this, properties);
            _.each(properties, function(values, property) {
                switch(property) {
                    case "action_bar_layer_set_background_color":
                        this._backgroundColour.setValue(IB.ColourMap[values[0][1]]);
                        break;
                    case "action_bar_layer_set_icon":
                        _.each(values, function(group) {
                            this._icons[group[1].split('_').pop().toLowerCase()].setValue(mappings[group[2]].getID());
                        }, this);
                        break;
                }
            }, this);
        },
        _handleIconChange: function(it, new_icon) {
            var old_icon = this._old_icon_ids[it];
            if(old_icon != '') {
                this._canvas.getResources().removeResource(old_icon);
            }
            this._canvas.getResources().addResource('GBitmap', new_icon);
            this._old_icon_ids[it] = new_icon;
        }
    });

    IB.layerRegistry.register(IB.ActionBarLayer);
})();
