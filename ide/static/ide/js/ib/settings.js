(function() {
    IB.Settings = {};

    IB.Settings.ColourMode = {
        name: gettext("Preview Mode"),
        id: 'ib-setting-colourmode',
        isEnabled: function() {return IB.ColourEnabled;},
        renderNode: function (parent) {
            var isColour = IB.colourMode == IB.ColourModes.Colour;
            return $('<select>')
                .append(interpolate('<option value="0" %s>%s</option>', [(isColour ? 'selected' : ''), gettext("Colour")]))
                .append(interpolate('<option value="1" %s>%s</option>', [(isColour ? '' : 'selected'), gettext("Monochrome")]))
                .change(_.bind(this.handleChange, parent));
        },
        handleChange: function (evt) {
            IB.colourMode = parseInt(evt.target.value, 10);
            this.trigger('refresh');
        }
    };

    /**
     * Settings view that shows renders a global settings form in to a given parent node
     * @param parent
     * @param canvas
     * @constructor
     */
    IB.SettingsForm = function (parent, ib) {
        this._ib = ib;
        this._parent = parent;
        this._formNode = null;
        _.extend(this, Backbone.Events);
    };
    IB.SettingsForm.prototype = {
        /**
         * Renders the form into the parent node.
         */
        render: function () {
            if (!this._formNode) {
                this._formNode = $('<form class="ib-settings form-horizontal">')
                    .appendTo(this._parent);
            }

            var form = this._formNode;
            form.empty();
            _.chain(IB.Settings)
                .filter(function(setting){return setting.isEnabled();})
                .map(function(setting) {return this._generateControlGroup(setting);}, this)
                .each(function(element){form.append(element);});
        },
        /**
         * Empties the contents of the parent node
         */
        empty: function() {
            this._parent.empty();
        },
        /**
         * Generates a row for a single setting.
         * @param {IB.Property} setting The setting to render
         * @returns {jQuery} An HTML element suitable for inserting into the view
         * @private
         */
        _generateControlGroup: function (setting) {
            // Here we assume bootstrap magic... mostly because it's convenient.
            return $('<div class="control-group">')
                .append(
                $('<label class="control-label">')
                    .text(setting.name)
                    .attr('for', setting.id))
                .append(
                $('<div class="controls">')
                    .append(setting.renderNode(this)));
        }
    };
})();
