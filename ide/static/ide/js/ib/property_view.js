(function() {
    /**
     * Renders a property view for the given layer into the given HTML element.
     * @param {jQuery|HTMLElement} parent The node to render into.
     * @param {IB.Layer|IB.Canvas} layer The layer for which to render properties.
     * @constructor
     */
    IB.PropertyView = function(parent, layer) {
        this._parent = parent;
        this._layer = layer;
        this._root = $('<div class="form-horizontal">');
        this._delete = $('<div style="text-align: center;"></div>');
        $('<button class="btn btn-danger">' + gettext("Delete layer") + '</button>')
            .on('click', _.bind(this._deleteLayer, this))
            .appendTo(this._delete);
    };
    IB.PropertyView.prototype = {
        /**
         * Renders the property view
         */
        render: function() {
            var groups = _.map(
                _.reject(this._layer.getProperties(), function(x) { return x.isLocked(); }),
                this._generateControlGroup);
            this._root
                .empty()
                .append($('<h2>').text(this._layer.getTypeName()))
                .append(groups)
                .appendTo(this._parent);
            if(this._layer instanceof IB.Layer) {
                this._root.append(this._delete);
            }
        },
        /**
         * Destroys the property view
         */
        destroy: function() {
            _.each(this._layer.getProperties(), function(property) {
                property.getNode().detach();
            });
            this._root.empty();
            this._root = null;
            this._parent = null;
            this._layer = null;
        },
        /**
         * Generates a row for a single property.
         * @param {IB.Property} property The property to render
         * @returns {jQuery} An HTML element suitable for inserting into the view
         * @private
         */
        _generateControlGroup: function(property) {
            // Here we assume bootstrap magic... mostly because it's convenient.
            return $('<div class="control-group">')
                .append(
                    $('<label class="control-label">')
                        .text(property.getName()))
                .append(
                    $('<div class="controls">')
                        .append(property.getNode()));
        },
        _deleteLayer: function() {
            this._layer.deleteLayer();
        }
    };
})();
