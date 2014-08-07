(function() {
    /**
     * A reorderable list of layers.
     * @param {jQuery|HTMLElement} holder Element that holds the list
     * @param {IB.Canvas} canvas
     * @constructor
     */
    IB.LayerListView = function(holder, canvas) {
        this._parent = holder;
        this._canvas = canvas;
        canvas.on('addlayer', this._handleNewLayer, this);
        canvas.on('removelayer', this._handleDeleteLayer, this);
        this._init();
    };
    IB.LayerListView.prototype = {
        constructor: IB.LayerListView,
        _init: function() {
            this._node = $('<ul class="ib-layerlistview list">')
                .appendTo(this._parent)
                .sortable()
                .on('sortupdate', _.bind(this._handleShuffle, this));
        },
        _handleShuffle: function(e, ui) {
            this._canvas.moveLayer(ui.oldindex, ui.item.index());
        },
        _handleNewLayer: function(layer) {
            var node = $('<li>')
                .text(layer.getID())
                .data('layer-id',layer.getID())
                .click(_.bind(function() {
                    this._canvas.selectLayer(layer);
                }, this))
                .appendTo(this._node);
            layer.on('changeID', function(oldID, newID) {
                node.text(newID).data('layer-id', newID);
            });
            this._node.sortable('reload');
        },
        _handleDeleteLayer: function(layer) {
            _.find(this._node.find('li'), function(x) {return $(x).data('layer-id') == layer.getID();}).remove();
        }
    };
})();
