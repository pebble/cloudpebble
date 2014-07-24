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
    };
    IB.TextLayer.prototype = Object.create(IB.Layer.prototype);
    IB.TextLayer.constructor = IB.TextLayer;
    IB.TextLayer.layerClass = 'TextLayer';
    _.extend(IB.TextLayer.prototype, {
        init: function() {
            this._node.css('background-color', 'black');
        },
        render: function(parent) {
            IB.Layer.prototype.render.call(this, parent);
            this._node.css({
                'background-color': this._backgroundColour.css,
                color: this._textColour.css
            });
            this._node.text(this._text);
        }
    });

    IB.registry.register(IB.TextLayer);
})();
