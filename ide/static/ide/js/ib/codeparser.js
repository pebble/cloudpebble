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
            // Matches functions where 'id' is the first argument, and extracts the function name and its other arguments
            var regex = new RegExp('^\\s*([a-zA-Z_]+)\\s*\\(' + id + ',\\s*(.+)\\);$', 'gm');
            // Splits the remaining arguments by any commas, which aren't followed by closing brackets
            var splitRegex = /,(?![^,]*\))/g;
            var groups;
            var props = Object.create(null);
            // Look through the document for any functions whose first arguments are the desired layer ID.
            while((groups = regex.exec(this._source))) {
                if(!props[groups[1]]) {
                    props[groups[1]] = [];
                }
                var fullString = groups[2].trim();
                // Extract all function arguments. If any arguments are functions containing more arguments,
                // extract the arguments of those functions.
                var innerArgumentsRegex = /([A-Za-z_]+)\s*\((.*?)\)/g;
                var args = _.chain(groups[2].split(splitRegex))
                    .invoke('trim')
                    .map(function(argument) {
                        var innerGroup;
                        if ((innerGroup = innerArgumentsRegex.exec(argument)) != null) {
                            return _([innerGroup[1]].concat(innerGroup[2].split(splitRegex))).invoke('trim');
                        }
                        else {
                            return argument;
                        }
                    }).value();
                var prop = [fullString].concat(args);
                props[groups[1]].push(prop);
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
            var regex = new RegExp('^\\s*' + id + '\\s*=.+create.+GRect\\(([0-9-]+), ([0-9-]+), ([0-9-]+), ([0-9-]+)\\)\\);', 'm');
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
        _getInitialiserForThing: function(id) {
            var regex = new RegExp('^\\s*' + id + '\\s*=\\s*([a-z_]+)\\((.*)\\);\\s*$', 'm');
            var result = regex.exec(this._source);
            if(result) {
                return result.slice(1);
            } else {
                return null;
            }
        },
        /**
         * Parses the given source for a window layout, updates the given canvas, adds the relevant layers,
         * and returns the list of layers found.
         * @param canvas
         * @returns {IB.Layer[]}
         */
        parse: function(canvas) {
            var thingRegex = /^static\s*([a-z]+) \*?([a-z0-9_]+);\s*$/gim;
            var results = [];
            var groups;
            var resourceMapping = Object.create(null);
            while((groups = thingRegex.exec(this._source))) {
                var thingType = groups[1];
                var thingID = groups[2];
                if(thingType == "Window") {
                    canvas.readProperties(this._getPropertiesForLayerID('s_window'));
                    continue;
                }
                var layerClass = IB.layerRegistry.getClass(thingType);
                if(layerClass) {
                    var layer = new layerClass(canvas, thingID);

                    var frame = this._getFrameForLayerID(thingID);
                    if(frame) {
                        layer.setPos(frame.pos.x, frame.pos.y);
                        layer.setSize(frame.size.w, frame.size.h);
                    }

                    layer.readProperties(this._getPropertiesForLayerID(thingID), resourceMapping);

                    results.push(layer);
                    continue;
                }
                var resourceClass = IB.resourceRegistry.getClass(thingType);
                if(resourceClass) {
                    var init = this._getInitialiserForThing(thingID);
                    if(!init) {
                        continue;
                    }
                    resourceMapping[thingID] = resourceClass.resourceFromInitialiser(init[0], init[1]);
                    continue;
                }
            }
            canvas.addLayers(results);
            return results;
        }
    };
})();
