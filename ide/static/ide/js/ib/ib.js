(function() {
    /**
     * Represents an Interface Builder, which drives everything else.
     * @param {jQuery|HTMLElement} canvasPane HTML element into which to render the canvas.
     * @param {jQuery|HTMLElement} propertyPane HTML element into which to render the property view.
     * @param {jQuery|HTMLElement} toolkitPane HTML element into which to render the toolkit view.
     * @param {string} source The source code, for some reason?
     * @constructor
     */
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

        /**
         * Handles changing the selection. If a layer is passed, selects that. If null, selects the window.
         * @param {?IB.Layer} selectedLayer The layer to select, or null to just deselect the active layer.
         * @private
         */
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

        /**
         * Given some source code, reconstitutes the window layout.
         * @param {string} source
         */
        this.setSource = function(source) {
            mCanvas.clear();
            var parser = new IB.Codeparser(source);
            var layers = parser.parse(mCanvas);
            IB.Layer.setLayerCounter(layers.length);
        };

        /**
         * Given some source code, returns source code containing the generated UI.
         * If the source already contained generated UI it will be replaced; else it will be injected.
         * @param {string} source
         * @returns {string}
         */
        this.integrateSource = function(source) {
            var codegen = new IB.Codegen(mCanvas);
            return codegen.integrateSource(source);
        };

        init();
    }
    window.IB = IB;
})();
