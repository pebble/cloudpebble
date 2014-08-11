(function() {
    /**
     * Represents an Interface Builder, which drives everything else.
     * @param {jQuery|HTMLElement} canvasPane HTML element into which to render the canvas.
     * @param {jQuery|HTMLElement} propertyPane HTML element into which to render the property view.
     * @param {jQuery|HTMLElement} toolkitPane HTML element into which to render the toolkit view.
     * @param {jQuery|HTMLElement} layerPane HTML element into which to render the layer view.
     * @param {string} source The source code, for some reason?
     * @constructor
     * @extends {Backbone.Events}
     */
    function IB(canvasPane, propertyPane, toolkitPane, layerPane, source) {
        var mCanvas;
        var mPropertyView;
        var mToolkit;
        var mLayerListView;
        var mSource = '';
        var self = this;

        _.extend(this, Backbone.Events);

        function init() {
            mCanvas = new IB.Canvas(canvasPane);
            mCanvas.on('selection', handleSelection);
            mToolkit = new IB.Toolkit(toolkitPane, mCanvas);
            mToolkit.renderList();
            mLayerListView = new IB.LayerListView(layerPane, mCanvas);
            mCanvas.on('changed', handleChange);
            handleSelection(null);
            CloudPebble.Analytics.addEvent("cloudpebble_ib_displayed", null, null, ['cloudpebble']);
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
            self.trigger('selection');
        }

        function handleChange() {
            self.trigger('changed');
        }

        /**
         * Given some source code, reconstitutes the window layout.
         * @param {string} source
         * @param {?boolean} reparse If false, do not parse the source.
         */
        this.setSource = function(source, reparse) {
            mSource = source;
            if(reparse !== false) {
                mCanvas.clear();
                var parser = new IB.Codeparser(source);
                var layers = parser.parse(mCanvas);
            }
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

        this.clean = function() {
            mCanvas.clear();
            canvasPane.empty();
            propertyPane.empty();
            toolkitPane.empty();
            layerPane.empty();
            init();
        };

        init();
    }
    window.IB = IB;
})();
