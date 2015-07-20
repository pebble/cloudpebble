function make_live_settings_form(options) {
    // Set up default options for the live settings form
    var opts = _.defaults(options || {}, {
        save_function: null,
        form: null,
        error_function: console.log,
        control_selector: 'input, select',
        changeable_control_selector: 'input',
        label_selector: '.control-group label',
        group_selector: '.control-group'
    });
    if (!_.isFunction(opts.save_function)
        || (!_.isObject(opts.form))
        || (!_.isFunction(opts.error_function))) {
        throw "Invalid arguments to make_live_settings_form";
    }

    // Add status icons to every form element
    $("<span class='settings-status-icons'>" +
        "<span class='icon-ok setting-saved'></span>" +
        "<span class='icon-edit setting-changed'></span>" +
        "</span>")
        .insertAfter(opts.form.find(opts.label_selector))
        .children().hide();


    var clear_changed_icons = function() {
        // Replace all visible changed icons with a one-second 'tick'
        opts.form.find('.setting-changed:visible').siblings('.setting-saved').show().delay(1000).hide('fast');
        opts.form.find('.setting-changed').hide();
    };

    var flash_tick_icon = function(element) {
        // Show the 'tick' icon for an element for one second
        element.parents(opts.group_selector).find('.setting-saved').show().delay(1000).hide('fast');
    };

    var show_changed_icon = function(element) {
        // Show the 'changed' icon for an element
        element.parents(opts.group_selector).find('.setting-changed').show('fast');
    };

    // Set up a hook for any changed form elements
    opts.form.find(opts.control_selector).change(function() {
        var self = this;
        // After the form is saved, flash the 'tick' icon on success or keep a 'changed' icon on error.
        opts.save_function()
            .done(function() {
                clear_changed_icons();
                flash_tick_icon($(self));
            })
            .fail(function(error) {
                opts.error_function(error);
                show_changed_icon($(self));
            });
    });

    // While typing in text forms, show the changed icon
    opts.form.find(opts.changeable_control_selector).on('input', function() {
        show_changed_icon($(this));
    });

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
}
