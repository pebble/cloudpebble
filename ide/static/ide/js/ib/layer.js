(function() {
    var sLayerCounter = 0;
    /**
     * Creates a generic layer.
     * @param {string} id The ID of the layer (to be used as a C identifier)
     * @constructor
     */
    IB.Layer = function(id) {
        var self = this;
        var mNode = null;
        var mID = null;
        var mPos = new IB.Pos();
        var mSize = new IB.Size();

        /**
         * Initialises the layer.
         * @param {String} [id] - ID/name of the layer. Defaults to "layer_n", for some unique n.
         */
        function init(id) {
            mNode = $('<div class="ib-layer">');
            mNode.data('layer', self); // reference cycles? pfft.
            mNode.css({
                position: 'absolute',
                backgroundColor: 'white'
            });
            mID = id || ("layer_" + ++sLayerCounter)
        }

        /**
         * Generates a C declaration for the layer.
         * @returns {string[]} C code
         */
        this.generateDeclaration = function() {
            return ["static Layer *" + mID + ";"];
        };

        /**
         * Generates a GRect indicating the frame of the layer
         * @returns {string[]} C code
         */
        this.generateRect = function() {
            return ["GRect(" + mPos.x + ", " + mPos.y + ", " + mSize.w + ", " + mSize.h + ")"];
        };

        /**
         * Generates an initialiser to create the layer.
         * @returns {string[]} C code
         */
        this.generateInitialiser = function() {
            return [mID + " = layer_create(" + self.generateRect() + ");"];
        };

        /**
         * Generates a destructor for the layer
         * @returns {string[]} C code
         */
        this.generateDestructor = function() {
            return ["layer_destroy(" + mID + ");"];
        };

        /**
         * Returns the size of the layer.
         * @returns {IB.Size}
         */
        this.getSize = function() {
            return _.clone(mSize);
        };

        /**
         * Sets the size of the layer.
         * @param {Number} w - layer width
         * @param {Number} h - layer height
         */
        this.setSize = function(w, h) {
            mSize = new IB.Size(w, h);
        };

        /**
         * Returns the position of the layer.
         * @returns {IB.Pos}
         */
        this.getPos = function() {
            return _.clone(mPos);
        };

        /**
         * Sets the position of the layer.
         * @param {Number} x
         * @param {Number} y
         */
        this.setPos = function(x, y) {
            mPos = new IB.Pos(x, y);
        };



        /**
         * Renders the layer. Note that it can only be displayed once.
         * @param {jQuery|HTMLElement} parent Node to render the layer into.
         */
        this.render = function(parent) {
            parent = $(parent);
            mNode.appendTo(parent);
            mNode.css({
                height: mSize.h,
                width: mSize.w,
                top: mPos.y,
                left: mPos.x
            });
        };

        init();
    };
})();
