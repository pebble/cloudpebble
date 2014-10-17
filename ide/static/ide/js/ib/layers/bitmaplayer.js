(function() {
    /**
     * Represents a BitmapLayer
     * @param {IB.Canvas} canvas
     * @param {string} id Layer ID
     * @constructor
     * @extends {IB.Layer}
     */
    IB.BitmapLayer = function(canvas, id) {
        IB.Layer.call(this, canvas, id);
        this._resource = new IB.Properties.Bitmap(gettext("Image"), '');
        this._bg_colour = new IB.Properties.Colour(pgettext("background colour", "Background"), IB.ColourClear);
        this._has_changed_image = false;
        this._node.addClass('ib-bitmaplayer');
        this.setSize(40, 40);
        _.extend(this._properties, {
            bitmap: this._resource,
            bg: this._bg_colour
        });
        this._old_resource_id = '';
        this._resource.on('change', this.setResourceID, this);
        this._bg_colour.on('change', this.setBackgroundColour, this);
    };
    IB.BitmapLayer.prototype = Object.create(IB.Layer.prototype);
    IB.BitmapLayer.prototype.constructor = IB.BitmapLayer;
    IB.BitmapLayer.className = 'BitmapLayer';
    IB.BitmapLayer.description = gettext("BitmapLayer will display an opaque bitmap image.");
    _.extend(IB.BitmapLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.css({
                'background-repeat': 'no-repeat',
                'background-color': this._bg_colour.getValue().css
            });
            if(this._has_changed_image) {
                var url = this._resource.getBitmapURL();
                this._node.css({
                    'background-image': 'url(' + url + ')'
                });
                this._has_changed_image = false;
            }
        },
        setResourceID: function(id) {
            this._has_changed_image = true;
            if(this._old_resource_id != '') {
                this._canvas.getResources().removeResource('GBitmap', this._old_resource_id);
            }
            if(id != '') {
                this._canvas.getResources().addResource('GBitmap', this._resource.getValue());
            }
            this._old_resource_id = this._resource.getValue();
            this._resource.setValue(id);
            this.trigger('resourceChange', id);
        },
        setBackgroundColour: function(colour) {
            this._bg_colour.setValue(colour);
            this.trigger('backgroundColourChange', colour);
        },
        generateDeclaration: function() {
            return ["static BitmapLayer *" + this._ID + ";"];
        },
        generateInitialiser: function() {
            var init = [this._ID + " = bitmap_layer_create(" + this.generateRect() + ");"];
            if(this._resource.getValue()) {
                init.push("bitmap_layer_set_bitmap(" + this._ID + ", " + this._canvas.getResources().getResource(this._resource.getValue()) + ");");
            }
            if(this._bg_colour.getValue() != IB.ColourClear) {
                init.push("bitmap_layer_set_background_color(" + this._ID + ", " + this._bg_colour.getValue().name + ");");
            }
            return init;
        },
        generateDestructor: function() {
            return ["bitmap_layer_destroy(" + this._ID + ");"];
        },
        readProperties: function(properties, mappings) {
            IB.Layer.prototype.readProperties.call(this, properties);
            _.each(properties, function(values, property) {
                switch(property) {
                    case "bitmap_layer_set_background_color":
                        this.setBackgroundColour(IB.ColourMap[values[0][1]]);
                        break;
                    case "bitmap_layer_set_bitmap":
                        if(mappings[values[0][1]]) {
                            this.setResourceID(mappings[values[0][1]].getID());
                        }
                        break;
                }
            }, this);
        },
        destroy: function() {
            var res = this._resource.getValue();
            if(res != '') {
                this._canvas.getResources().removeResource(res);
            }
            IB.Layer.prototype.destroy.call(this);
        }
    });

    IB.layerRegistry.register(IB.BitmapLayer);
})();
