(function() {
    /**
     * @namespace
     */
    IB.Properties = {};

    /**
     * Represents a generic property. Abstract.
     * @param {string} name Name of the property.
     * @param {*} value Value of the property.
     * @constructor
     * @abstract
     * @extends {Backbone.Events}
     */
    IB.Properties.Property = function(name, value) {
        this._name = name;
        this._value = value;
        this._node = this._generateNode();
        this._locked = false;
        _.extend(this, Backbone.Events);
    };
    IB.Properties.Property.prototype = {
        /**
         * @returns {string} The name of the property
         */
        getName: function() {
            return this._name;
        },
        /**
         * @returns {*} The value of the property.
         */
        getValue: function() {
            return this._value;
        },
        /**
         * Sets the value of the property.
         * @param value
         */
        setValue: function(value) {
            if(this._locked) {
                return;
            }
            if(!_.isEqual(value, this._value)) {
                var oldValue = this._value;
                this._value = value;
                this.trigger('change', value, oldValue);
            }
        },
        getNode: function() {
            return this._node;
        },
        /**
         * Locks the property to its current value; henceforth it is immutable.
         */
        lock: function() {
            this._locked = true;
        },
        isLocked: function() {
            return this._locked;
        },
        /**
         * Generates a node.
         * @abstract
         */
        _generateNode: function() {
            throw new Error("_generateNode not implemented.");
        },
        /**
         * Destroys the property.
         */
        destroy: function() {
            // nothing to do.
        }
    };
    var Property = IB.Properties.Property;
    var _super = Property.prototype;

    /**
     * Represents an integer property.
     * @param {string} name The name of the property
     * @param {Number} value The starting value
     * @param {Number} min The minimum value
     * @param {Number} max The maximum value
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Int = function(name, value, min, max) {
        Property.call(this, name, value);
        this._min = min;
        this._max = max;
    };
    IB.Properties.Int.prototype = Object.create(_super);
    IB.Properties.Int.prototype.constructor = IB.Properties.Int;
    _.extend(IB.Properties.Int.prototype, {
        /**
         * Sets the value of the property, clamped between min and max (inclusive).
         * @param {Number} value
         */
        setValue: function(value) {
            _super.setValue.call(this, Math.max(this._min, Math.min(this._max, value))|0);
            this._node.val(this._value);
        },
        /**
         * Generates an element for editing integers.
         * @returns {jQuery} A suitable input element
         */
        _generateNode: function() {
            var node = $('<input type="number" class="ib-property ib-integer">');
            if(this._min != -Infinity) {
                node.attr("min", this._min);
            }
            if(this._max != Infinity) {
                node.attr("max", this._max);
            }
            node.val(this._value);
            node.change(_.bind(this._handleChange, this));
            return node;
        },
        _handleChange: function() {
            var val = parseInt(this._node.val(), 10);
            if(val != this._value) {
                this.setValue(val);
            }
        }
    });

    IB.Properties.Bool = function(name, value) {
        Property.call(this, name, value);
    };
    IB.Properties.Bool.prototype = Object.create(_super);
    IB.Properties.Bool.prototype.constructor = IB.Properties.Bool;
    _.extend(IB.Properties.Bool.prototype, {
        setValue: function(value) {
            _super.setValue.call(this, value);
            this._node.prop('checked', this._value);
        },
        _generateNode: function() {
            return $('<input type="checkbox" class="ib-property ib-boolean">')
                .prop("checked", this._value)
                .change(_.bind(this._handleChange, this));
        },
        _handleChange: function() {
            this.setValue(this._node.prop('checked'));
        }
    });

    /**
     * Represents a text property.
     * @param {string} name The name of the property.
     * @param {string} value The value of the property
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Text = function(name, value, realtime) {
        this._realtime = (realtime !== false);
        Property.call(this, name, value);
    };
    IB.Properties.Text.prototype = Object.create(_super);
    IB.Properties.Text.prototype.constructor = IB.Properties.Text;
    _.extend(IB.Properties.Text.prototype, {
        setValue: function(value) {
            _super.setValue.call(this, value);
            if(this._node.val() != this._value) {
                this._node.val(this._value);
            }
        },
        _generateNode: function() {
            var node = $('<input type="text" class="ib-property ib-text">')
                .val(this._value)
                .change(_.bind(this._handleChange, this));
            if(this._realtime) {
                node.keyup(_.bind(this._handleChange, this));
            }
            return node;
        },
        _handleChange: function() {
            var val = this._node.val();
            if(val != this._value) {
                this.setValue(val);
            }
        }
    });

    /**
     * Represents a colour property.
     * @param {string} name The name of the property
     * @param {IB.Colour} value The value of the property
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Colour = function(name, value) {
        Property.call(this, name, value);
    };
    IB.Properties.Colour.prototype = Object.create(_super);
    IB.Properties.Colour.prototype.constructor = IB.Properties.Colour;
    _.extend(IB.Properties.Colour.prototype, {
        setValue: function(value) {
            _super.setValue.call(this, value);
            this._node.val(this._value.name);
        },
        _generateNode: function() {
            return $('<select class="ib-property ib-colour">')
                .append(this._createColour(IB.ColourWhite))
                .append(this._createColour(IB.ColourBlack))
                .append(this._createColour(IB.ColourClear))
                .val(this._value.name)
                .change(_.bind(this._handleChange, this));
        },
        _createColour: function(colour) {
            return $('<option>')
                .attr('value', colour.name)
                .text(colour.display);
        },
        _handleChange: function() {
            var mapping = {};
            mapping[IB.ColourWhite.name] = IB.ColourWhite;
            mapping[IB.ColourBlack.name] = IB.ColourBlack;
            mapping[IB.ColourClear.name] = IB.ColourClear;
            var val = mapping[this._node.val()];
            if(val != this._value) {
                this.setValue(val);
            }
        }
    });

    /**
     * Represents a generic multiple choice property
     * @param {string} name The user-visible name of the property
     * @param {Object.<string, string>} options Mapping of options; value -> human name
     * @param {string} value The default value
     * @constructor
     */
    IB.Properties.MultipleChoice = function(name, options, value) {
        this._options = options;
        Property.call(this, name, value);
    };
    IB.Properties.MultipleChoice.prototype = Object.create(_super);
    IB.Properties.MultipleChoice.prototype.constructor = IB.Properties.MultipleChoice;
    _.extend(IB.Properties.MultipleChoice.prototype, {
        _generateNode: function() {
            return $('<select class="ib-property ib-multiplechoice">')
                .append(_.map(this._options, function(text, value) {
                    return $('<option>')
                        .attr('value', value)
                        .text(text);
                }))
                .val(this._value)
                .change(_.bind(this._handleChange, this));
        },
        _handleChange: function() {
            this.setValue(this._node.val());
        },
        setValue: function(value) {
            if(!_.has(this._options, value)) {
                return;
            }
            _super.setValue.call(this, value);
            this._node.val(this._value);
        }
    });

    /**
     * Represents a bitmap resource.
     * @param {string} name The name of the property
     * @param {string} value The associated bitmap resource
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Bitmap = function(name, value) {
        Property.call(this, name, value);
    };
    IB.Properties.Bitmap.prototype = Object.create(_super);
    IB.Properties.Bitmap.prototype.constructor = IB.Properties.Bitmap;
    _.extend(IB.Properties.Bitmap.prototype, {
        setValue: function(value) {
            _super.setValue.call(this, value);
            this._node.val(this._value);
        },
        getBitmapURL: function() {
            if(this._value == '') {
                return null;
            }
            var resource = CloudPebble.Resources.GetResourceByID(this._value);
            if(resource) {
                return '/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/0/get';
            } else {
                return null;
            }
        },
        _generateNode: function() {
            if(CloudPebble.Resources.GetBitmaps().length == 0) {
                return $("<p>You must add a new image resource on the left before you can select a bitmap here.</p>");
            }
            return $('<select class="ib-property ib-bitmap">')
                .append(this._createBitmapOption('', "Blank"))
                .append(_.map(CloudPebble.Resources.GetBitmaps(), function(resource) {
                    return this._createBitmapOption(resource.identifiers[0], resource.file_name);
                }, this))
                .val(this._value)
                .change(_.bind(this._handleChange, this));
        },
        _createBitmapOption: function(id, name) {
            return $('<option>')
                .attr('value', id)
                .text(name);
        },
        _handleChange: function() {
            this.setValue(this._node.val());
        }
    });

    /**
     * Represents a size property
     * @param {string} name The name of the property
     * @param {IB.Size} value The size of the layer
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Size = function(name, value) {
        this._w_node = null;
        this._h_node = null;
        Property.call(this, name, value);
    };
    IB.Properties.Size.prototype = Object.create(_super);
    IB.Properties.Size.prototype.constructor = IB.Properties.Size;
    _.extend(IB.Properties.Size.prototype, {
        _generateNode: function() {
            this._w_node = $('<input type="number">')
                .attr('min', 0)
                .attr('max', 32767)
                .val(this._value.w)
                .change(_.bind(this._handleChange, this));
            this._h_node = $('<input type="number">')
                .attr('min', 0)
                .attr('max', 32767)
                .val(this._value.h)
                .change(_.bind(this._handleChange, this));
            return $('<span>').append(this._w_node, ' x ', this._h_node);
        },
        _handleChange: function() {
            var w = parseInt(this._w_node.val(), 10);
            var h = parseInt(this._h_node.val(), 10);
            if(w == this._value.w && h == this._value.h) {
                return;
            }
            this.setValue(new IB.Size(w, h));
        },
        setValue: function(value) {
            _super.setValue.call(this, value);
            this._w_node.val(this._value.w);
            this._h_node.val(this._value.h);
        }
    });

    /**
     * Represents a position property
     * @param {string} name The name of the property
     * @param {IB.Pos} value The position of the layer
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Pos = function(name, value) {
        this._x_node = null;
        this._y_node = null;
        Property.call(this, name, value);
    };
    IB.Properties.Pos.prototype = Object.create(_super);
    IB.Properties.Pos.prototype.constructor = IB.Properties.Pos;
    _.extend(IB.Properties.Pos.prototype, {
        _generateNode: function() {
            this._x_node = $('<input type="number">')
                .attr('min', -32768)
                .attr('max', 32767)
                .val(this._value.x)
                .change(_.bind(this._handleChange, this));
            this._y_node = $('<input type="number">')
                .attr('min', -32768)
                .attr('max', 32767)
                .val(this._value.y)
                .change(_.bind(this._handleChange, this));
            return $('<span>').append(this._x_node, ', ', this._y_node);
        },
        _handleChange: function() {
            var x = parseInt(this._x_node.val(), 10);
            var y = parseInt(this._y_node.val(), 10);
            if(x == this._value.x && y == this._value.y) {
                return;
            }
            this.setValue(new IB.Pos(x, y));
        },
        setValue: function(value) {
            _super.setValue.call(this, value);
            this._x_node.val(this._value.x);
            this._y_node.val(this._value.y);
        }
    });

    /**
     * Represents a font available for use by the app.
     * @param {string} name Name of the property
     * @param {string} value Name of the font.
     * @constructor
     * @extends {IB.Properties.Property}
     */
    IB.Properties.Font = function(name, value) {
        this._fonts = {
            "GOTHIC_14": {
                css: {
                    'font-family': "'Raster Gothic 14'",
                    'font-weight': 'normal',
                    'font-style': 'normal',
                    'font-size': 14,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 14",
                builtin: true
            },
            "GOTHIC_14_BOLD": {
                css: {
                    'font-family': "'Raster Gothic 14'",
                    'font-weight': 'bold',
                    'font-style': 'normal',
                    'font-size': 14,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 14 Bold",
                builtin: true
            },
            "GOTHIC_18": {
                css: {
                    'font-family': "'Raster Gothic 18'",
                    'font-weight': 'normal',
                    'font-style': 'normal',
                    'font-size': 18,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 18",
                builtin: true
            },
            "GOTHIC_18_BOLD": {
                css: {
                    'font-family': "'Raster Gothic 18'",
                    'font-weight': 'bold',
                    'font-style': 'normal',
                    'font-size': 18,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 18 Bold",
                builtin: true
            },
            "GOTHIC_24": {
                css: {
                    'font-family': "'Raster Gothic 24'",
                    'font-weight': 'normal',
                    'font-style': 'normal',
                    'font-size': 24,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 24",
                builtin: true
            },
            "GOTHIC_24_BOLD": {
                css: {
                    'font-family': "'Raster Gothic 24'",
                    'font-weight': 'bold',
                    'font-style': 'normal',
                    'font-size': 24,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 24 Bold",
                builtin: true
            },
            "GOTHIC_28": {
                css: {
                    'font-family': "'Raster Gothic 28'",
                    'font-weight': 'normal',
                    'font-style': 'normal',
                    'font-size': 28,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 28",
                builtin: true
            },
            "GOTHIC_28_BOLD": {
                css: {
                    'font-family': "'Raster Gothic 28'",
                    'font-weight': 'bold',
                    'font-style': 'normal',
                    'font-size': 28,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Gothic 28 Bold",
                builtin: true
            },
            "BITHAM_30_BLACK": {
                css: {
                    'font-family': "'Gotham A', 'Gotham B'",
                    'font-weight': 800,
                    'font-style': 'normal',
                    'font-size': 30,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Bitham 30 Black",
                builtin: true
            },
            "BITHAM_42_BOLD": {
                css: {
                    'font-family': "'Gotham A', 'Gotham B'",
                    'font-weight': 700,
                    'font-style': 'normal',
                    'font-size': 42,
                    'letter-spacing': -2,
                    'font-kerning': 'none'
                },
                name: "Bitham 42 Bold",
                builtin: true
            },
            "BITHAM_42_LIGHT": {
                css: {
                    'font-family': "'Gotham A', 'Gotham B'",
                    'font-weight': 300,
                    'font-style': 'normal',
                    'font-size': 42,
                    'letter-spacing': -3,
                    'font-kerning': 'none'
                },
                name: "Bitham 42 Light",
                builtin: true
            },
            "BITHAM_42_MEDIUM_NUMBERS": {
                css: {
                    'font-family': "'Gotham Numbers A', 'Gotham Numbers B'",
                    'font-weight': 500,
                    'font-style': 'normal',
                    'font-size': 42,
                    'letter-spacing': -3,
                    'font-kerning': 'none'
                },
                name: "Bitham 42 Medium (Numbers)",
                builtin: true,
                charRegex: /[0-9:-]/
            },
            "BITHAM_34_MEDIUM_NUMBERS": {
                css: {
                    'font-family': "'Gotham Numbers A', 'Gotham Numbers B'",
                    'font-weight': 500,
                    'font-style': 'normal',
                    'font-size': 34,
                    'letter-spacing': -2,
                    'font-kerning': 'none'
                },
                name: "Bitham 34 Medium (Numbers)",
                builtin: true,
                charRegex: /[0-9:\.,-]/
            },
            "ROBOTO_CONDENSED_21": {
                css: {
                    'font-family': "'Roboto Condensed'",
                    'font-weight': 400,
                    'font-style': 'normal',
                    'font-size': 21,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Roboto Condensed 21",
                builtin: true
            },
            "ROBOTO_BOLD_SUBSET_49": {
                css: {
                    'font-family': "Roboto",
                    'font-weight': 700,
                    'font-style': 'normal',
                    'font-size': 49,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Roboto Bold Subset",
                builtin: true,
                charRegex: /[:0-9]/
            },
            "DROID_SERIF_28_BOLD": {
                css: {
                    'font-family': "'Droid Serif'",
                    'font-weight': 700,
                    'font-style': 'normal',
                    'font-size': 28,
                    'letter-spacing': 0,
                    'font-kerning': 'none'
                },
                name: "Droid Serif 28 Bold",
                builtin: true
            }
        };
        _.extend(this._fonts, _.object(_.flatten(_.map(CloudPebble.Resources.GetFonts(), function(font) {
            return _.map(font.extra, function(info, resource_id) {
                var font_size = parseInt(resource_id.match(/[0-9]+$/)[0], 10);
                return [resource_id, {
                    css: {
                        'font-family': CloudPebble.Resources.GetDefaultFontFamily(font),
                        'font-size': font_size,
                        'letter-spacing': info.tracking || 0,
                        'font-kerning': 'none'
                    },
                    name: resource_id,
                    builtin: false,
                    charRegex: info.regex ? new RegExp(info.regex) : null
                }];
            });
        }), true)));
        Property.call(this, name, value);
    };
    IB.Properties.Font.prototype = Object.create(_super);
    IB.Properties.Font.prototype.constructor = IB.Properties.Font;
    _.extend(IB.Properties.Font.prototype, {
        setValue: function(value) {
            if(!(value in this._fonts)) {
                return;
            }
            _super.setValue.call(this, value);
            this._node.val(this._value);
        },
        _generateNode: function() {
            return $('<select class="ib-property ib-font">')
                .append(_.map(this._fonts, this._generateOption, this))
                .val(this._value)
                .change(_.bind(this._handleChange, this));
        },
        _generateOption: function(font, id) {
            return $('<option>')
                .attr('value', id)
                .text(font.name);
        },
        _handleChange: function() {
            var val = this._node.val();
            if(this._value != val) {
                this.setValue(val);
            }
        },
        getCSS: function() {
            return this._fonts[this._value].css;
        },
        filterText: function(text) {
            var regex = this._fonts[this._value].charRegex;
            if(!regex) {
                return text;
            }
            return _.map(text, function(char) {
                return regex.test(char) ? char : "\u25AF"
            }).join('');
        },
        isCustom: function() {
            return !this._fonts[this._value].builtin;
        },
        getHeight: function() {
            return this._fonts[this._value].css['font-size'];
        }
    });
})();
