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
        canvas.on('selection', this._handleSelection, this);
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
            var count = this._canvas.getLayers().length;
            this._canvas.moveLayer(count - ui.oldindex - 1, count - ui.item.index() - 1);
        },
        _handleNewLayer: function(layer) {
            var node = $('<li>')
                .text(layer.getID())
                .data('layer-id',layer.getID())
                .click(_.bind(function() {
                    this._canvas.selectLayer(layer);
                }, this))
                .prependTo(this._node);
            layer.on('changeID', function(oldID, newID) {
                node.text(newID).data('layer-id', newID);
            });
            this._node.sortable('reload');
        },
        _handleDeleteLayer: function(layer) {
            this._getLayerNode(layer).remove();
        },
        _handleSelection: function(layer) {
            this._node.find('li.selected').removeClass('selected');
            if(layer != null) {
                this._getLayerNode(layer).addClass('selected');
            }
        },
        _getLayerNode: function(layer) {
            return $(_.find(this._node.find('li'), function(x) {return $(x).data('layer-id') == layer.getID();}));
        }
    };
})();
