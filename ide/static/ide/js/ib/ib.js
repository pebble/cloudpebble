(function() {
    function IB(canvasPane, propertyPane, toolkitPane, source) {
        var mCanvas;
        var mToolkit;

        function init() {
            mCanvas = new IB.Canvas(canvasPane);
            mToolkit = new IB.Toolkit(toolkitPane, mCanvas);
            mToolkit.renderList();
        }

        init();
    }
    window.IB = IB;
})();
