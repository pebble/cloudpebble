(function() {
    /**
     * Represents an IB canvas, which can contain layers.
     * @param {jQuery|HTMLElement} parent Node to which to attach the canvas.
     * @constructor
     */
    IB.Canvas = function(parent) {
        var self = this;
        var mChildren = [];
        var mNode = null;
        var mScaleX = null;
        var mScaleY = null;
        var mBackgroundColour = IB.ColourWhite;

        // Drag tracking.
        var mMouseDownCoords = null;
        var mMouseDownNode = null;
        var mMouseNodeOffset = null;

        function init(parent) {
            mNode = $('<div class="ib-canvas">');
            mNode.on('mousedown', handleMouseDown);
            mNode.appendTo(parent);

            mScaleX = parent.width() / 144;
            mScaleY = parent.height() / 168;

            var cssTransform = 'scale(' + mScaleX + ',' + mScaleY + ')';

            mNode.css({
                width: 144,
                height: 168,
                position: 'relative',
                '-webkit-transform-origin': '0 0',
                '-moz-transform-origin': '0 0',
                '-ms-transform-origin': '0 0',
                'transform-origin': '0 0',
                '-webkit-transform': cssTransform,
                '-moz-transform': cssTransform,
                '-ms-transform': cssTransform,
                transform: cssTransform,
                overflow: 'hidden'
            });
        }

        /**
         * Given a mouse event from jQuery, returns a canvas-relative Pos indicating the mouse position.
         * @param {jQuery.Event} e jQuery event object
         * @returns {IB.Pos} Canvas position
         */
        function eventToPosition(e) {
            return pageCoordsToPosition(e.pageX, e.pageY);
        }

        function offsetToPosition(offset) {
            return pageCoordsToPosition(offset.left, offset.top);
        }

        function pageCoordsToPosition(x, y) {
            var me = mNode.offset();
            return new IB.Pos((x - me.left) / mScaleX, (y - me.top) / mScaleY);
        }

        function handleMouseDown(e) {
            if(e.which != 1) return; // left mouse button
            mNode.one('mouseup', handleMouseUp);
            mNode.on('mousemove', handleDrag);
            $('body').one('mouseup', handlePageMouseUp);
            mMouseDownCoords = eventToPosition(e);
            mMouseDownNode = $(e.target);
            console.log(mMouseDownNode);
            if(mMouseDownNode) {
                var nodePos = offsetToPosition(mMouseDownNode.offset());
                mMouseNodeOffset = {x: mMouseDownCoords.x - nodePos.x, y: mMouseDownCoords.y - nodePos.y};
                console.log(mMouseNodeOffset);
            }
        }

        function handleMouseUp(e) {
            var mouseUpCoords = eventToPosition(e);
            if(mouseUpCoords.x == mMouseDownCoords.x && mouseUpCoords.y == mMouseDownCoords.y) {
                handleClick(e);
            }
        }

        function handlePageMouseUp(e) {
            mNode.off('mousemove', handleDrag);
            mMouseDownCoords = null;
            mMouseDownNode = null;
        }

        function handleDrag(e) {
            console.log("dragging");
            // If it's a layer, set its position.
            if(mMouseDownNode) {
                var mousePos = eventToPosition(e);
                var layer = mMouseDownNode.data('layer');
                if(layer && layer instanceof IB.Layer) {
                    layer.setPos(mousePos.x - mMouseNodeOffset.x, mousePos.y - mMouseNodeOffset.y);
                    layer.render(mNode);
                }
            }
        }

        function handleClick(e) {
            console.log("clicking");
        }

        /**
         *
         * @param {IB.Layer} layer
         */
        this.addLayer = function(layer) {
            mChildren.push(layer);
            layer.render(mNode);
        };

        this.generateDeclaration = function() {
            return ["static Window *window;"];
        };

        this.generateInitialiser = function() {
            var initialiser = ["window = window_create();"];
            if(mBackgroundColour != IB.ColourWhite) {
                initialiser.push("window_set_background_color(window, " + mBackgroundColour + ");");
            }
            return initialiser;
        };

        this.generateDestructor = function() {
            return ["window_destroy(window);"];
        };

        init(parent);
    };
})();
