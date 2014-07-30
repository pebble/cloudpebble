(function() {
    /**
     * Parses generated source code to reconstruct a window.
     * @param {string} source The generated source code
     * @constructor
     */
    IB.Codeparser = function(source) {
        this._raw_source = source;
        this._beginBlock = '// BEGIN AUTO-GENERATED UI CODE; DO NOT MODIFY';
        this._endBlock = '// END AUTO-GENERATED UI CODE';
        this._source = this._getGeneratedSource();
    };
    IB.Codeparser.prototype = {
        /**
         * Returns the relevant source code.
         * @returns {?string} The generated source code, if any was found. Else null.
         * @private
         */
        _getGeneratedSource: function() {
            var start = this._raw_source.indexOf(this._beginBlock);
            var end = this._raw_source.indexOf(this._endBlock);
            if(start >= 0 && end > start) {
                return this._raw_source.substring(start + this._beginBlock.length, end);
            }
            return null;
        },
        /**
         * Given a layer ID, fetches and splits up function calls affecting it.
         * @param {string} id The layer ID
         * @returns {Object.<string, string[]>} Mapping from function calls to parameters.
         * @private
         */
        _getPropertiesForLayerID: function(id) {
            var regex = new RegExp('^\\s*([a-zA-Z_]+)\\s*\\(' + id + ',\\s*(.+)\\);$', 'gm');
            var groups;
            var props = Object.create(null);
            while((groups = regex.exec(this._source))) {
                props[groups[1]] = _.invoke([groups[2]].concat(groups[2].split(',')), 'trim');
            }
            return props;
        },
        /**
         * Returns the position and size of a layer, or null if it couldn't be determined.
         * @param {string} id The layer ID
         * @returns {?{pos: IB.Pos, size: IB.Size}}
         * @private
         */
        _getFrameForLayerID: function(id) {
            var regex = new RegExp('^\\s*' + id + '\\s*=.+create.+GRect\\((\\d+), (\\d+), (\\d+), (\\d+)\\)\\);', 'm');
            var match = regex.exec(this._source);
            if(match) {
                return {
                    pos: new IB.Pos(parseInt(match[1], 10), parseInt(match[2], 10)),
                    size: new IB.Size(parseInt(match[3], 10), parseInt(match[4], 10))
                };
            } else {
                return null;
            }
        },
        /**
         * Finds the mapping between GBitmap pointer names and resource IDs.
         * @returns {Object.<string, string>} A variable -> resource ID mapping. The RESOURCE_ID_ is omitted.
         * @private
         */
        // This is an unfortunate hack, but I dunno where else it could go.
        _getBitmapMappings: function() {
            var regex = /^\s*([A-Za-z0-9_]+) = gbitmap_create_with_resource\(RESOURCE_ID_([A-Za-z0-9_]+)\);\s*$/gm;
            var groups;
            var mapping = Object.create(null);
            while((groups = regex.exec(this._source))) {
                mapping[groups[1]] = groups[2];
            }
            return mapping;
        },
        /**
         * Parses the given source for a window layout, updates the given canvas, adds the relevant layers,
         * and returns the list of layers found.
         * @param canvas
         * @returns {IB.Layer[]}
         */
        parse: function(canvas) {
            var thingRegex = /^static\s*([a-z]+) \*([a-z0-9_]+);\s*$/gim;
            var results = [];
            var groups;
            var gbitmap_mapping = this._getBitmapMappings();
            while((groups = thingRegex.exec(this._source))) {
                var layerType = groups[1];
                var layerID = groups[2];
                if(layerType == "Window") {
                    canvas.readProperties(this._getPropertiesForLayerID('s_window'));
                    continue;
                }
                var layerClass = IB.registry.getLayerClass(layerType);
                if(!layerClass) {
                    continue;
                }
                var layer = new layerClass(layerID);

                var frame = this._getFrameForLayerID(layerID);
                if(frame) {
                    layer.setPos(frame.pos.x, frame.pos.y);
                    layer.setSize(frame.size.w, frame.size.h);
                }

                layer.readProperties(this._getPropertiesForLayerID(layerID), gbitmap_mapping);

                results.push(layer);
            }
            canvas.addLayers(results);
            return results;
        }
    };
})();
