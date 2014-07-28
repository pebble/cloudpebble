(function() {
    /**
     * Represents a TextLayer.
     * @param id
     * @extends IB.Layer
     * @constructor
     */
    IB.TextLayer = function(id) {
        IB.Layer.call(this, id);
        this._node.addClass('ib-textlayer');

        _.extend(this._properties, {
            text: new IB.Properties.Text("Text", "Text layer"),
            fg: new IB.Properties.Colour("Text colour", IB.ColourBlack),
            bg: new IB.Properties.Colour("Background colour", IB.ColourWhite)
        });
        this._text = this._properties.text;
        this._textColour = this._properties.fg;
        this._backgroundColour = this._properties.bg;
        this._text.on('change', function(value) {
            this.trigger('textChange', value);
        }, this);
        this._textColour.on('change', function(value) {
            this.trigger('backgroundColourChange', value);
        }, this);
        this._backgroundColour.on('change', function(value) {
            this.trigger('textColourChange', value);
        }, this);

        this.setSize(100, 20);
    };
    IB.TextLayer.prototype = Object.create(IB.Layer.prototype);
    IB.TextLayer.constructor = IB.TextLayer;
    IB.TextLayer.layerClass = 'TextLayer';
    _.extend(IB.TextLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.css({
                'background-color': this._backgroundColour.getValue().css,
                color: this._textColour.getValue().css
            });
            this._node.text(this._text.getValue());
        },
        setText: function(text) {
            this._text.setValue(text);
        },
        getText: function() {
            return this._text.getValue();
        },
        setTextColour: function(colour) {
            this._textColour.setValue(colour);
        },
        setBackgroundColour: function(colour) {
            this._backgroundColour.setValue(colour);
        },
        generateDeclaration: function() {
            return ["static TextLayer *" + this._ID + ";"];
        },
        generateInitialiser: function() {
            var init = [this._ID + " = text_layer_create(" + this.generateRect() + ");"];
            if(this._backgroundColour.getValue() != IB.ColourWhite) {
                init.push("text_layer_set_background_color(" + this._ID + ", " + this._backgroundColour.getValue().name + ");");
            }
            if(this._textColour.getValue() != IB.ColourBlack) {
                init.push("text_layer_set_text_color(" + this._ID + ", " + this._textColour.getValue().name + ");");
            }
            if(this._text.getValue() != "") {
                init.push("text_layer_set_text(" + this._ID + ", \"" + IB.escapeCString(this.getText()) + "\");");
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
