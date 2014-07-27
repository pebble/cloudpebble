(function() {
    /**
     * Represents a TextLayer.
     * @param id
     * @extends IB.Layer
     * @constructor
     */
    IB.TextLayer = function(id) {
        IB.Layer.call(this, id);
        this._text = "Text layer";
        this._backgroundColour = IB.ColourWhite;
        this._textColour = IB.ColourBlack;
        this._node.addClass('ib-textlayer');
        this.setSize(100, 20);

        _.extend(this._properties, {
            text: new IB.Properties.Text("Text", this._text),
            fg: new IB.Properties.Colour("Text colour", this._textColour),
            bg: new IB.Properties.Colour("Background colour", this._backgroundColour)
        });
        this._properties.text.on('change', function(value) {
            this.setText(value);
        }, this);
        this._properties.fg.on('change', function(value) {
            this.setTextColour(value);
        }, this);
        this._properties.bg.on('change', function(value) {
            this.setBackgroundColour(value);
        }, this);
    };
    IB.TextLayer.prototype = Object.create(IB.Layer.prototype);
    IB.TextLayer.constructor = IB.TextLayer;
    IB.TextLayer.layerClass = 'TextLayer';
    _.extend(IB.TextLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.css({
                'background-color': this._backgroundColour.css,
                color: this._textColour.css
            });
            this._node.text(this._text);
        },
        setText: function(text) {
            if(this._text == text) {
                return;
            }
            this._text = text;
            this._properties.text.setValue(text);
            this.trigger('textChange', text);
        },
        setTextColour: function(colour) {
            if(this._textColour == colour) {
                return;
            }
            this._textColour = colour;
            this._properties.fg.setValue(colour);
            this.trigger('textColourChange', colour);
        },
        setBackgroundColour: function(colour) {
            if(this._backgroundColour == colour) {
                return;
            }
            this._backgroundColour = colour;
            this._properties.bg.setValue(colour);
            this.trigger('backgroundColourChange', colour);
        },
        generateDeclaration: function() {
            return ["static TextLayer *" + this._ID + ";"];
        },
        generateInitialiser: function() {
            var init = [this._ID + " = text_layer_create(" + this.generateRect() + ");"];
            if(this._backgroundColour != IB.ColourWhite) {
                init.push("text_layer_set_background_color(" + this._ID + ", " + this._backgroundColour.name + ");");
            }
            if(this._textColour != IB.ColourBlack) {
                init.push("text_layer_set_text_color(" + this._ID + ", " + this._textColour.name + ");");
            }
            if(this._text != "") {
                init.push("text_layer_set_text(" + this._ID + ", \"" + IB.escapeCString(this._text) + "\");");
            }
            return init;
        },
        generateDestructor: function() {
            return ["text_layer_destroy(" + this._ID + ");"];
        },
        readProperties: function(properties) {
            IB.Layer.prototype.readProperties.call(this, properties);
            _.each(properties, function(values, property) {
                switch(property) {
                    case "text_layer_set_background_color":
                        this.setBackgroundColour(IB.ColourMap[values[1]]);
                        break;
                    case "text_layer_set_text_color":
                        this.setTextColour(IB.ColourMap[values[1]]);
                        break;
                    case "text_layer_set_text":
                        this.setText(JSON.parse(values[0]));
                        break;
                }
            }, this);
        }
    });

    IB.registry.register(IB.TextLayer);
})();
