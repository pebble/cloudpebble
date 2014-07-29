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
                this._value = value;
                this.trigger('change', value);
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
    IB.Properties.Int.constructor = IB.Properties.Int;
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
    IB.Properties.Bool.constructor = IB.Properties.Bool;
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
    IB.Properties.Text = function(name, value) {
        Property.call(this, name, value);
    };
    IB.Properties.Text.prototype = Object.create(_super);
    IB.Properties.Text.constructor = IB.Properties.Text;
    _.extend(IB.Properties.Text.prototype, {
        setValue: function(value) {
            _super.setValue.call(this, value);
            if(this._node.val() != this._value) {
                this._node.val(this._value);
            }
        },
        _generateNode: function() {
            return $('<input type="text" class="ib-property ib-text">')
                .val(this._value)
                .keyup(_.bind(this._handleChange, this))
                .change(_.bind(this._handleChange, this));
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
    IB.Properties.Colour.constructor = IB.Properties.Colour;
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

    IB.Properties.MultipleChoice = function(name, options, value) {
        this._options = options;
        Property.call(this, name, value);
    };
    IB.Properties.MultipleChoice.prototype = Object.create(_super);
    IB.Properties.MultipleChoice.constructor = IB.Properties.MultipleChoice;
    _.extend(IB.Properties.MultipleChoice.prototype, {
        _generateNode: function() {
            return $('<select class="ib-property ib-multiplechoice">')
                .append(_.map(this._options, function(text, value) {
                    console.log(text, value);
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
    IB.Properties.Bitmap.constructor = IB.Properties.Bitmap;
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
                return '/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/get';
            } else {
                return null;
            }
        },
        _generateNode: function() {
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
    IB.Properties.Size.constructor = IB.Properties.Size;
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
    IB.Properties.Pos.constructor = IB.Properties.Pos;
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
})();
