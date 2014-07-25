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
     */
    IB.Properties.Property = function(name, value) {
        this._name = name;
        this._value = value;
        this._node = this._generateNode();
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
            if(value != this._value) {
                this._value = value;
                this.trigger('change', value);
            }
        },
        getNode: function() {
            return this._node;
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
            this._node.val(this._value);
        },
        _generateNode: function() {
            return $('<input type="text" class="ib-property ib-text">')
                .val(this._value)
                .keyup(_.bind(this._handleChange, this));
            return node;
        },
        _handleChange: function() {
            var val = this._node.val();
            if(val != this._value) {
                this.setValue(val);
            }
        }
    });
})();
