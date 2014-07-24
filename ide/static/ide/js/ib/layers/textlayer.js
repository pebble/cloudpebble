(function() {
    IB.TextLayer = function(id) {
        IB.Layer.call(this, id);
    };
    IB.TextLayer.prototype = Object.create(IB.Layer.prototype);
    IB.TextLayer.constructor = IB.TextLayer;
    _.extend(IB.TextLayer.prototype, {
        init: function() {
            this._node.css('background-color', 'black');
        }
    });
})();
