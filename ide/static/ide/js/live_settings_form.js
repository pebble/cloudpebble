/**
 *
 * @param options Customisation options.
 * @param options.form The form element to automatically save
 * @param options.save_function {Function} A function returning a promise called when the form needs to be saved
 * @param options.error_function {Function} A function to be called if saving fails.
 * @param options.on_save_function {Function|null} An optional function called when the form is successfully saved
 * @param options.on_change_function {Function|null} An optional function called when any form elements are changed
 * @param options.control_selector {string} A selector string which should select all auto-saving controls
 * @param options.changeable_control_selector {string} A selector which should specifically select any controls
 *      which may be in a state of 'changed but unsaved' (e.g. text boxes)
 * @param options.label_selector {string} Select elements which should have form icons inserted after them.
 * @param options.group_selector {string} This should select elements which group inputs and labels together.
 */
function make_live_settings_form(options) {
    // Set up default options for the live settings form
    var opts = _.defaults(options || {}, {
        save_function: null,
        form: null,
        error_function: console.log,
        on_save_function: null,
        on_change_function: null,
        control_selector: 'input, select, textarea',
        changeable_control_selector: "input[type!='number'], textarea",
        label_selector: '.control-group label',
        group_selector: '.control-group'
    });
    if (!_.isFunction(opts.save_function)
        || (!_.isObject(opts.form))
        || (!_.isFunction(opts.error_function))
        || (!!opts.on_change_function && !_.isFunction(opts.on_change_function))
        || (!!opts.on_save_function && !_.isFunction(opts.on_save_function))) {
        throw new Error("Invalid arguments to make_live_settings_form");
    }
    opts.form = $(opts.form);

    /** Trigger the form save callback
     *
     * @param element A jquery object containing elements to show tick icons for.
     * @param event Event object to be passed to the save callback
     */
    function save(element, event) {
        // After the form is saved, flash the 'tick' icon on success or keep a 'changed' icon on error.
        function on_save_error(error) {
            opts.error_function(error);
            if (element) show_changed_icon(element);
        }

        try {
            return Promise.resolve(opts.save_function(event)).then(function (result) {
                if (result && result.incomplete) return;
                clear_changed_icons();
                if (element) flash_tick_icon(element);
                if (_.isFunction(opts.on_save_function)) {
                    opts.on_save_function()
                }
            }).catch(function (error) {
                on_save_error(error);
            });
        }
        catch (error) {
            on_save_error(error);
        }
    }

    /** Replace all visible changed icons with a one-second 'tick' */
    function clear_changed_icons() {
        opts.form.find('.setting-changed:visible').siblings('.setting-saved').show().delay(1000).hide('fast');
        opts.form.find('.setting-changed').hide();
    }

    /** Show the 'tick' icon for an element for one second */
    function flash_tick_icon(element) {
        element.closest(opts.group_selector).find('.setting-saved').show().delay(1000).hide('fast');
    }

    /** Show the 'changed' icon for an element */
    function show_changed_icon(element) {
        element.closest(opts.group_selector).find('.setting-changed').show('fast');
        if (_.isFunction(opts.on_change_function)) {
            opts.on_change_function(element);
        }
    }

    /** Add status icons to to all matched form groups inside an element  
     * @param elements An element (e.g. table row or form) which contains form groups
     * to add to the autosave system.
     * @param changed if true, also show the changed icon for all new form groups
     */
    function add_status_icons(elements, changed) {
        $("<span class='settings-status-icons'>" +
            "<span class='icon-ok setting-saved'></span>" +
            "<span class='icon-edit setting-changed'></span>" +
            "</span>")
            .insertAfter(elements.find(opts.label_selector))
            .children().hide();

        if (changed) {
            show_changed_icon(elements.find(opts.control_selector));
        }
    }

    /** Set up the live form's event hooks and add status icons for all form groups */
    function init() {
        // When a form-reset button is clicked, submit the form instantly
        opts.form.bind("reset", function() {
            var values = {};
            // Keep track of the previous values of all form elements
            opts.form.find(opts.control_selector).each(function() {
                values[this.id] = $(this).val();
            });

            _.defer(function() {
                var func = null;
                // After saving, show 'tick' or 'changed' icons for all modified settings.
                opts.save_function()
                    .then(function() {
                        clear_changed_icons();
                        func = flash_tick_icon;
                    })
                    .catch(function(error) {
                        opts.error_function(error);
                        func = show_changed_icon;
                    })
                    .finally(function() {
                        opts.form.find(opts.control_selector).each(function() {
                            if (_.has(values, this.id) && values[this.id] !== $(this).val()) {
                                func($(this));
                            }
                        });
                    });
            });

        });

        // Set up the save-on-change hook
        opts.form.on("change", opts.control_selector, function(e) {
            if (_.isFunction(opts.on_change_function)) {
                opts.on_change_function(this);
            }
            save($(this), e);
        });

        // While typing in text forms, show the changed icon
        opts.form.on('input', opts.changeable_control_selector, function() {
            show_changed_icon($(this));
        });

        add_status_icons(opts.form, false);
    }

    return {
        clearIcons: function() {
            clear_changed_icons();
        },
        addElement: function(elements, changed) {
            add_status_icons(elements, changed);
        },
        init: function() {
            init();
        },
        save: function(element) {
            save(element);
        }
    };
}
