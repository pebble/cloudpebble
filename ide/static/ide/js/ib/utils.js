(function() {
    /**
     * Represents a position
     * @param {Number} [x=0] x coordinate
     * @param {Number} [y=0] y coordinate
     * @constructor
     */
    IB.Pos = function(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    };

    /**
     * Represents a size
     * @param {Number} [w=0] width
     * @param {Number} [h=0] height
     * @constructor
     */
    IB.Size = function(w, h) {
        this.w = w || 0;
        this.h = h || 0;
    }

    IB.ColourWhite = 'GColorWhite';
    IB.ColourBlack = 'GColorBlack';
    IB.ColourClear = 'GColorClear';
})();
