function make_live_settings_form(options) {
    // Set up default options for the live settings form
    var opts = _.defaults(options || {}, {
        save_function: null,
        form: null,
        error_function: console.log,
        on_change_function: null,
        control_selector: 'input, select, textarea',
        changeable_control_selector: "input[type!='number'], textarea",
        label_selector: '.control-group label',
        group_selector: '.control-group'
    });
    if (!_.isFunction(opts.save_function)
        || (!_.isObject(opts.form))
        || (!_.isFunction(opts.error_function))
        || (!!opts.on_change_function && !_.isFunction(opts.on_change_function))) {
        throw "Invalid arguments to make_live_settings_form";
    }

    var save = function(element, event) {
        // After the form is saved, flash the 'tick' icon on success or keep a 'changed' icon on error.
        var promise = opts.save_function(event);

        if (promise) {
            promise.done(function () {
                clear_changed_icons();
                if (element) flash_tick_icon(element);
            }).fail(function (error) {
                opts.error_function(error);
                if (element) show_changed_icon(element);
            });
        }
    };

    var clear_changed_icons = function() {
        // Replace all visible changed icons with a one-second 'tick'
        opts.form.find('.setting-changed:visible').siblings('.setting-saved').show().delay(1000).hide('fast');
        opts.form.find('.setting-changed').hide();
    };

    var flash_tick_icon = function(element) {
        // Show the 'tick' icon for an element for one second
        element.parents(opts.group_selector).find('.setting-saved').show().delay(1000).hide('fast');
    };

    var show_changed_icon = function(element, speed) {
        // Show the 'changed' icon for an element
        speed = (speed === undefined ? 'fast' : speed);
        element.parents(opts.group_selector).find('.setting-changed').show(speed);
        if (_.isFunction(opts.on_change_function)) {
            opts.on_change_function(element);
        }
    };

    var hookup_elements = function(elements) {
        // Set up a hook for any changed form elements
        elements.on("change", opts.control_selector, function(e) {
            console.log("GHCAFAS");
            if (_.isFunction(opts.on_change_function)) {
                opts.on_change_function(this);
            }
            save($(this), e);
        });

        // While typing in text forms, show the changed icon
        elements.on('input', opts.changeable_control_selector, function(e) {
            console.log("OMG");
            show_changed_icon($(this), e);
        });
    };

    var add_status_icon = function(element, changed) {
        $("<span class='settings-status-icons'>" +
            "<span class='icon-ok setting-saved'></span>" +
            "<span class='icon-edit setting-changed'></span>" +
            "</span>")
            .insertAfter(element)
            .children().hide();
        if (changed === true) {
            show_changed_icon(element, null);
        }
    };

    var init = function() {
        // Add status icons to every form element
        add_status_icon(opts.form.find(opts.label_selector));
        // When a form-reset button is clicked, submit the form instantly
        $(opts.form).bind("reset", function() {
            var values = {};
            // Keep track of the previous values of all form elements
            opts.form.find(opts.control_selector).each(function() {
                values[this.id] = $(this).val();
            });

            setTimeout(function() {
                var func = null;
                // After saving, show 'tick' or 'changed' icons for all modified settings.
                opts.save_function()
                    .done(function() {
                        clear_changed_icons();
                        func = flash_tick_icon;
                    })
                    .fail(function(error) {
                        opts.error_function(error);
                        func = show_changed_icon;
                    })
                    .always(function() {
                        opts.form.find(opts.control_selector).each(function() {
                            if (_.has(values, this.id) && values[this.id] !== $(this).val()) {
                                func($(this));
                            }
                        });
                    });
            });

        });

        hookup_elements(opts.form);
    };

    var self = {
        clearIcons: function() {
            console.log("Clearing icons!");
            clear_changed_icons();
        },
        addElement: function(elements) {
            hookup_elements(elements);
        },
        init: function() {
            init();
            return self;
        },
        save: function(element) {
            save(element);
        },
        addStatusIcon: function(element, changed) {
            add_status_icon(element, changed);
        }
    };

    return self;
}