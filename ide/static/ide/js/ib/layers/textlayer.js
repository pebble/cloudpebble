(function() {
    /**
     * Represents a TextLayer.
     * @param id
     * @extends IB.Layer
     * @constructor
     */
    IB.TextLayer = function(id) {
        IB.Layer.call(this, id);
        this._size = new IB.Size(100, 20);
        this._text = "Text layer";
        this._backgroundColour = IB.ColourWhite;
        this._textColour = IB.ColourBlack;

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
        }
    });

    IB.registry.register(IB.TextLayer);
})();
