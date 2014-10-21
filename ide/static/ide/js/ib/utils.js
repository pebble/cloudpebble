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
    };

    IB.Colour = function(name, css, display) {
        this.name = name;
        this.css = css;
        this.display = display;

        this.toString = function() {
            return this.name;
        };
    };

    IB.ColourWhite = new IB.Colour('GColorWhite', 'white', gettext('White'));
    IB.ColourBlack = new IB.Colour('GColorBlack', 'black', gettext('Black'));
    IB.ColourClear = new IB.Colour('GColorClear', 'rgba(0, 0, 0, 0)', gettext('Transparent'));

    IB.ColourMap = {
        GColorWhite: IB.ColourWhite,
        GColorBlack: IB.ColourBlack,
        GColorClear: IB.ColourClear
    };

    /**
     * Escapes a string by replacing sequences that are illegal in C.
     * @param {string} string
     * @returns {string}
     */
    IB.escapeCString = function(string) {
        return string
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\\n")
    };
})();
