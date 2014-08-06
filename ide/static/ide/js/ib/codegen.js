(function() {
    /**
     * Code generator.
     * @param {IB.Canvas} canvas
     * @constructor
     */
    IB.Codegen = function(canvas) {
        this._canvas = canvas;
        this._beginBlock = '// BEGIN AUTO-GENERATED UI CODE; DO NOT MODIFY';
        this._endBlock = '// END AUTO-GENERATED UI CODE';
    };
    IB.Codegen.prototype = {
        generateDeclaration: function() {
            var code = this._canvas.generateDeclaration();
            code = code.concat(this._canvas.getResources().generateDeclaration());
            code = code.concat(_.flatten(_.invoke(this._canvas.getLayers(), 'generateDeclaration')));
            return code.join("\n");
        },
        generateInitialiser: function() {
            var code = this._canvas.generateInitialiser();
            code.push('');
            code = code.concat(this._canvas.getResources().generateInitialiser());
            _.each(this._canvas.getLayers(), function(layer) {
                code.push('// ' + layer.getID());
                code = code.concat(layer.generateInitialiser());
                code.push("layer_add_child(window_get_root_layer(s_window), (Layer *)" + layer.getID() + ");");
                code.push('');
            });
            code.pop(); // get rid of stray blank line.
            var fn = [
                'static void initialise_ui(void) {'
            ];
            fn = fn.concat(_.map(code, function(line) {
                return '  ' + line;
            }));
            fn.push('}');
            return fn.join("\n");
        },
        generateDestructor: function() {
            var code = this._canvas.generateDestructor();
            _.each(this._canvas.getLayers(), function(layer) {
                code = code.concat(layer.generateDestructor());
            });
            code = code.concat(this._canvas.getResources().generateDestructor());
            var fn = [
                'static void destroy_ui(void) {'
            ];
            fn = fn.concat(_.map(code, function(line) {
                return '  ' + line;
            }));
            fn.push('}');
            return fn.join("\n");
        },
        integrateSource: function(source) {
            // This is the fun part. Given some arbitrary source, we attempt to insert
            // our code. For the declarations, initialisers and destructors we "just" have
            // to insert ours and delete any instances that already exist.
            // We then need to arrange for them to actually be called...

            // Find our block by searching for BIG ANGRY COMMENTS.
            var start = source.indexOf(this._beginBlock);
            var end = source.indexOf(this._endBlock + "\n");
            var index;
            var prefix = "";

            if(start != -1) {
                // Remove them.
                source = source.substring(0, start) + source.substring(end + this._endBlock.length);
                index = start;
            } else {
                // No existing block; try to find the last #include.
                var match = source.match(/^\s*#\s*include.*$(?!\s*#\s*include.*$)/m);
                if(match) {
                    index = match.index + match[0].length;
                    prefix = "\n\n";
                } else {
                    // Eh, stick it at the beginning.
                    index = 0;
                }
            }

            var generated = this._beginBlock
                + "\n" + this.generateDeclaration()
                + "\n\n" + this.generateInitialiser()
                + "\n\n" + this.generateDestructor()
                + "\n" + this._endBlock;

            source = source.substring(0, index) + prefix + generated + source.substring(index);

            return source;
        }
    };
})();
