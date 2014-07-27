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

        this.setSource = function(source) {
            mCanvas.clear();
            var parser = new IB.Codeparser(source);
            var layers = parser.parse();
            mCanvas.addLayers(layers);
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
