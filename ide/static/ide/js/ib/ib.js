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
            handleSelection(null);
        }

        function handleSelection(selectedLayer) {
            if(mPropertyView) {
                mPropertyView.destroy();
                mPropertyView = null;
            }
            if(selectedLayer) {
                mPropertyView = new IB.PropertyView(propertyPane, selectedLayer);
                mPropertyView.render();
            } else {
                mPropertyView = new IB.PropertyView(propertyPane, mCanvas);
                mPropertyView.render();
            }
        }

        this.setSource = function(source) {
            mCanvas.clear();
            var parser = new IB.Codeparser(source);
            var layers = parser.parse(mCanvas);
            IB.Layer.setLayerCounter(layers.length);
        };

        this.integrateSource = function(source) {
            var codegen = new IB.Codegen(mCanvas);
            return codegen.integrateSource(source);
        };

        init();
    }
    window.IB = IB;
})();
