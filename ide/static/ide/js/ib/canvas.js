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
        var mLastCoords = null;

        // Selection management
        var mSelectedLayer = null;
        var mResizer = null;

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
            return new IB.Pos(Math.round((x - me.left) / mScaleX), Math.round((y - me.top) / mScaleY));
        }

        function handleMouseDown(e) {
            if(e.which != 1) return; // left mouse button
            mNode.one('mouseup', handleMouseUp);
            mNode.on('mousemove', handleDrag);
            $('body').one('mouseup', handlePageMouseUp);
            mMouseDownCoords = eventToPosition(e);
            mLastCoords = _.clone(mMouseDownCoords);
            mMouseDownNode = $(e.target);
            console.log(mMouseDownNode);
            if(mMouseDownNode) {
                var nodePos = offsetToPosition(mMouseDownNode.offset());
                mMouseNodeOffset = {x: mMouseDownCoords.x - nodePos.x, y: mMouseDownCoords.y - nodePos.y};

                // We want to fiddle selections immediately on mousedown.
                if(mMouseDownNode[0] == mNode[0]) {
                    selectLayer(null);
                } else {
                    var object = mMouseDownNode.data('object');
                    if(object && object instanceof IB.Layer) {
                        selectLayer(object);
                    }
                }
            }
        }

        function handleMouseUp(e) {
            var mouseUpCoords = eventToPosition(e);
            if(mouseUpCoords.x == mMouseDownCoords.x && mouseUpCoords.y == mMouseDownCoords.y) {
                handleClick();
            }
        }

        function handlePageMouseUp(e) {
            mNode.off('mousemove', handleDrag);
            mMouseDownCoords = null;
            mMouseDownNode = null;
            mMouseNodeOffset = null;
            mLastCoords = null;
        }

        function handleDrag(e) {
            // If it's a layer, set its position.
            if(mMouseDownNode) {
                var mousePos = eventToPosition(e);
                var object = mMouseDownNode.data('object');
                if(!object) return;
                if(object instanceof IB.Layer) {
                    object.setPos(mousePos.x - mMouseNodeOffset.x, mousePos.y - mMouseNodeOffset.y);
                    object.render();
                } else if(object instanceof IB.Resizer) {
                    var layer = object.getLayer();
                    var size = layer.getSize();
                    var pos = layer.getPos();
                    var resizeX = mMouseDownNode.data('resize-x');
                    var resizeY = mMouseDownNode.data('resize-y');

                    if(resizeX == 1) {
                        size.w = Math.max(size.w + (mousePos.x - mLastCoords.x), 0);
                    } else if(resizeX == -1) {
                        size.w = Math.max(size.w - (mousePos.x - mLastCoords.x), 0);
                        pos.x = pos.x - (mLastCoords.x - mousePos.x);
                    }

                    if(resizeY == 1) {
                        size.h = Math.max(size.h + (mousePos.y - mLastCoords.y), 0);
                    } else if(resizeY == -1) {
                        size.h = Math.max(size.h - (mousePos.y - mLastCoords.y), 0);
                        pos.y = pos.y - (mLastCoords.y - mousePos.y);
                    }
                    layer.setSize(size.w, size.h);
                    layer.setPos(pos.x, pos.y);
                    layer.render();
                }
            }
            mLastCoords = eventToPosition(e);
        }

        function handleClick() {
            if(mMouseDownNode) {
            }
        }

        function selectLayer(layer) {
            if(mResizer != null) {
                mResizer.destroy();
                mResizer = null;
            }
            if(layer) {
                mResizer = new IB.Resizer(mNode, layer);
            }
            mSelectedLayer = layer;
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
