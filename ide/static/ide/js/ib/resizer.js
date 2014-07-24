(function() {
    IB.Resizer = function(parent, layer) {
        var self = this;
        var mParent = parent;
        var mLayer = layer;
        var mNode = null;

        var mUpperLeftHandle;
        var mUpperMiddleHandle;
        var mUpperRightHandle;
        var mLeftMiddleHandle;
        var mRightMiddleHandle;
        var mLowerLeftHandle;
        var mLowerMiddleHandle;
        var mLowerRightHandle;

        function init() {
            mNode = $('<div class="ib-resizer">')
                .css({
                    border: '1px dashed black',
                    width: mLayer.getSize().w - 2,
                    height: mLayer.getSize().h - 2,
                    position: 'absolute',
                    top: mLayer.getPos().y,
                    left: mLayer.getPos().x,
                    'pointer-events': 'none'
                })
                .data('object', self)
                .appendTo(mParent);
            mLayer.on('position', handlePosition);
            mLayer.on('size', handleSize);

            mUpperLeftHandle = makeHandle('upper-left', -1, -1);
            mUpperMiddleHandle = makeHandle('upper-middle', 0, -1);
            mUpperRightHandle = makeHandle('upper-right', 1, -1);
            mLeftMiddleHandle = makeHandle('middle-left', -1, 0);
            mRightMiddleHandle = makeHandle('middle-right', 1, 0);
            mLowerLeftHandle = makeHandle('lower-left', -1, 1);
            mLowerMiddleHandle = makeHandle('lower-middle', 0, 1);
            mLowerRightHandle = makeHandle('lower-right', 1, 1);
        }

        function makeHandle(which, resize_x, resize_y) {
            return $('<div class="ib-handle ib-handle-' + which + '">')
                .appendTo(mNode)
                .data('resize-x', resize_x)
                .data('resize-y', resize_y)
                .data('object', self);
        }

        function handlePosition(pos) {
            mNode.css({
                top: pos.y,
                left: pos.x
            });
        }

        function handleSize(size) {
            mNode.css({
                width: size.w - 2,
                height: size.h - 2
            });
        }

        this.getLayer = function() {
            return mLayer;
        };

        this.destroy = function() {
            mLayer.off('position', handlePosition);
            mLayer.off('size', handleSize);
            mNode.remove();
            mParent = null;
            mLayer = null;
            mNode = null;
        };

        init();
    };
})();
