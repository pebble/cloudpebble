(function() {
    /**
     * Represents a BitmapLayer
     * @param {string} id Layer ID
     * @constructor
     * @extends {IB.Layer}
     */
    IB.BitmapLayer = function(id) {
        IB.Layer.call(this, id);
        this._resource = new IB.Properties.Bitmap("Image", '');
        this._bg_colour = new IB.Properties.Colour("Background", IB.ColourClear);
        this._has_changed_image = false;
        this._node.addClass('ib-bitmaplayer');
        this.setSize(40, 40);
        _.extend(this._properties, {
            bitmap: this._resource,
            bg: this._bg_colour
        });
        this._resource.on('change', this.setResourceID, this);
        this._bg_colour.on('change', this.setBackgroundColour, this);
    };
    IB.BitmapLayer.prototype = Object.create(IB.Layer.prototype);
    IB.BitmapLayer.prototype.constructor = IB.BitmapLayer;
    IB.BitmapLayer.layerClass = 'BitmapLayer';
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
            this._resource.setValue(id);
            this.trigger('resourceChange', id);
        },
        setBackgroundColour: function(colour) {
            this._bg_colour.setValue(colour);
            this.trigger('backgroundColourChange', colour);
        },
        generateDeclaration: function() {
            var decl = ["static BitmapLayer *" + this._ID + ";"];
            if(this._resource.getValue()) {
                decl.push("static GBitmap *" + this._ID + "_gbitmap;");
            }
            return decl;
        },
        generateInitialiser: function() {
            var init = [this._ID + " = bitmap_layer_create(" + this.generateRect() + ");"];
            if(this._resource.getValue()) {
                init.push(this._ID + "_gbitmap = gbitmap_create_with_resource(RESOURCE_ID_" + this._resource.getValue() + ");");
                init.push("bitmap_layer_set_bitmap(" + this._ID + ", " + this._ID + "_gbitmap);");
            }
            if(this._bg_colour.getValue() != IB.ColourClear) {
                init.push("bitmap_layer_set_background_color(" + this._ID + ", " + this._bg_colour.getValue().name + ");");
            }
            return init;
        },
        generateDestructor: function() {
            var destroy = [];
            if(this._resource.getValue()) {
                destroy.push("gbitmap_destroy(" + this._ID + "_gbitmap);");
            }
            destroy.push("bitmap_layer_destroy(" + this._ID + ");");
            return destroy;
        },
        readProperties: function(properties, mappings) {
            IB.Layer.prototype.readProperties.call(this, properties);
            _.each(properties, function(values, property) {
                switch(property) {
                    case "bitmap_layer_set_background_color":
                        this.setBackgroundColour(IB.ColourMap[values[0][1]]);
                        break;
                    case "bitmap_layer_set_bitmap":
                        this.setResourceID(mappings[values[0][1]]);
                        break;
                }
            }, this);
        }
    });

    IB.registry.register(IB.BitmapLayer);
})();
