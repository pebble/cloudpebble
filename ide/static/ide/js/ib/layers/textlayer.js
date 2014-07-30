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
            font: new IB.Properties.Font("Font", "GOTHIC_14_BOLD"),
            fg: new IB.Properties.Colour("Text colour", IB.ColourBlack),
            bg: new IB.Properties.Colour("Background", IB.ColourWhite),
            align: new IB.Properties.MultipleChoice("Alignment", {
                "GTextAlignmentLeft": "Left",
                "GTextAlignmentCenter": "Centre",
                "GTextAlignmentRight": "Right"
            }, "GTextAlignmentLeft"),
        });
        this._text = this._properties.text;
        this._textColour = this._properties.fg;
        this._backgroundColour = this._properties.bg;
        this._align = this._properties.align;
        this._font = this._properties.font;
        this._propListener(this._text, 'textChange');
        this._propListener(this._textColour, 'textColourChange');
        this._propListener(this._backgroundColour, 'backgroundColourChange');
        this._propListener(this._align, 'alignmentChange');
        this._propListener(this._font, 'fontChange');

        this.setSize(100, 20);
    };
    IB.TextLayer.prototype = Object.create(IB.Layer.prototype);
    IB.TextLayer.prototype.constructor = IB.TextLayer;
    IB.TextLayer.layerClass = 'TextLayer';
    _.extend(IB.TextLayer.prototype, {
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.css({
                'background-color': this._backgroundColour.getValue().css,
                color: this._textColour.getValue().css,
                'text-align': {
                    "GTextAlignmentLeft": "left",
                    "GTextAlignmentCenter": "center",
                    "GTextAlignmentRight": "right"
                }[this._align.getValue()]
            });
            this._node.css(this._font.getCSS());
            this._node.text(this._font.filterText(this._text.getValue()).replace(/ /g, '\u00a0\u200B'));
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
            if(this._align.getValue() != "GTextAlignmentLeft") {
                init.push("text_layer_set_text_alignment(" + this._ID + ", " + this._align.getValue() + ");");
            }
            if(this._font.getValue() != "GOTHIC_14_BOLD") {
                init.push("text_layer_set_font(" + this._ID + ", fonts_get_system_font(FONT_KEY_" + this._font.getValue() + "));");
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
                        this.setBackgroundColour(IB.ColourMap[values[0][1]]);
                        break;
                    case "text_layer_set_text_color":
                        this.setTextColour(IB.ColourMap[values[0][1]]);
                        break;
                    case "text_layer_set_text":
                        this.setText(JSON.parse(values[0][0]));
                        break;
                    case "text_layer_set_text_alignment":
                        this._align.setValue(values[0][1]);
                        break;
                    case "text_layer_set_font":
                        if(/^fonts_get_system_font\(/.test(values[0])) {
                            this._font.setValue(values[0][0].substring(31, values[0][0].length - 1));
                        }
                        break;
                }
            }, this);
        }
    });

    IB.registry.register(IB.TextLayer);
})();
