jQuery.fn.extend({
    /**
     * Sets up a customised textext object with a set of default options and extra functions
     * to increase its usability as a tag-editing form element.
     * @param {object} options Any additional textextjs options
     * @returns {jQuery}
     */
    textext_tagger: function(options) {
        var self = this;
        var initialised = false;
        var default_options = {
            plugins : 'tags prompt focus autocomplete arrow',
            prompt : 'Resource tags',
            ext: {
                core: {
                    enabled: function(isEnabled) {
                        if (_.isUndefined(isEnabled)) {
                            return (!$(this).core().wrapElement().hasClass('disabled'));
                        }
                        else {
                            if (!!isEnabled) {
                                this.wrapElement().removeClass('disabled');
                                $(self).attr('disabled', false);
                            }
                            else {
                                this.wrapElement().addClass('disabled');
                                $(self).attr('disabled', true);
                            }
                            this.trigger('toggled');
                            return this;
                        }

                    }
                },
                arrow: {
                    onArrowClick: function() {
                        // This makes the arrow button show suggestions even when no query is entered
                        this.trigger('getSuggestions');
                        this.core().focusInput();
                    }
                },
                tags: {
                    onPostInit: function(e) {
                        // Ensure that we don't re-save the initial tags
                        $.fn.textext.TextExtTags.prototype.onPostInit.apply(this, arguments);
                        initialised = true;

                    },
                    addTags: function(tags)  {
                        // We extend the addTags/removeTag methods to trigger 'change'
                        // so that the live settings form can autosave.
                        $.fn.textext.TextExtTags.prototype.addTags.apply(this, arguments);
                        if (initialised) {
                            this.trigger('change');
                            this.trigger('input');
                        }
                    },
                    removeTag: function(tag) {
                        $.fn.textext.TextExtTags.prototype.removeTag.apply(this, arguments);

                        if (initialised) {
                            this.trigger('change');
                            this.trigger('input');
                        }
                    },
                    empty: function() {
                        var core = this.core();
                        this.containerElement().empty();
                        this.updateFormCache();
                        core.getFormData();
                        core.invalidateBounds();
                        return this;
                    }
                }
            }
        };
        function deepExtend(target, source) {
            for (var prop in source)
                if (prop in target)
                    deepExtend(target[prop], source[prop]);
                else
                    target[prop] = source[prop];
            return target;
        }
        var final_options = deepExtend(default_options, options);

        // The textext library does strange things with with sizing. This seems to fix it.
        $(this).height($(this).height());
        return $(this).textext(final_options);
    }
});
