(function() {
    function IB(canvasPane, propertyPane, toolkitPane, source) {
        var mCanvas;
        var mPropertyView;
        var mToolkit;

        function init() {
            mCanvas = new IB.Canvas(canvasPane);
            mCanvas.on('selection', handleSelection);
            mToolkit = new IB.Toolkit(toolkitPane, mCanvas);
            mToolkit.renderList();
            window.mCanvas = mCanvas;
        }

        function handleSelection(selectedLayer) {
            if(mPropertyView) {
                mPropertyView.destroy();
                mPropertyView = null;
            }
            if(selectedLayer) {
                mPropertyView = new IB.PropertyView(propertyPane, selectedLayer);
                mPropertyView.render();
            }
        }

        this.getCanvas = function() {
            return mCanvas;
        };

        init();
    }
    window.IB = IB;
})();
