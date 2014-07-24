(function() {
    function IB(canvasPane, propertyPane, toolkitPane, source) {
        var mCanvas;

        function init() {
            mCanvas = new IB.Canvas(canvasPane);
            console.log(canvasPane);
            console.log(mCanvas);

            // testing
            var layer = new IB.Layer("test_layer");
            layer.setPos(30, 30);
            layer.setSize(50, 50);
            mCanvas.addLayer(layer);

            var layer2 = new IB.Layer("other_layer");
            layer2.setPos(80, 80);
            layer2.setSize(20, 20);
            mCanvas.addLayer(layer2);
        }

        init();
    }
    window.IB = IB;
})();
