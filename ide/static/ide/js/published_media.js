CloudPebble.PublishedMedia = (function() {
    var media_template = null;
    var item_template = null;
    var live_form = null;

    function get_media_items() {
        return media_template.find('.media-item').map(function() {
            return $(this).data('item');
        }).toArray().filter(function(item) {
            return !item.is_deleting();
        });
    }

    function get_form_data() {
        return _.map(get_media_items(), function(x) {
            return x.getData();
        })
    }

    /** This singleton manages the error box and loading indicator. */
    var alerts = new (function Alerts() {
        var pane;
        this.show_error = function show_error(error) {
            pane.find('.alert-error').removeClass('hide').text(error);
        };
        this.hide_error = function hide_error() {
            pane.find('.alert-error').addClass('hide');
        };
        this.init = function(set_pane) {
            pane = set_pane;
        }
    });

    function get_eligible_identifiers() {
        return _.chain(CloudPebble.Resources.GetResources()).filter(function(item) {
            return /^(png|pbi|bitmap|raw)/.test(item.kind);
        }).pluck('identifiers').flatten().uniq().value();
    }

    /** This class sets up and manages a single Published Media item panel. */
    function MediaItem() {
        var self = this;
        var deleting = false;
        var item_form = media_template.find('form');
        var item = item_template.clone().appendTo(item_form).data('item', this);
        var name_input = item.find('.edit-media-name');
        var id_input = item.find('.edit-media-id');
        var glance_input = item.find('.edit-media-glance');
        var timeline_checkbox = item.find('.edit-media-timeline');
        var timeline_tiny_input = item.find('.edit-media-timeline-tiny');
        var timeline_small_input = item.find('.edit-media-timeline-small');
        var timeline_large_input = item.find('.edit-media-timeline-large');
        var delete_btn = item.find('.btn-danger');


        function invalid_option(value) {
            return $('<option>').val(value).addClass('media-item-invalid').text(interpolate('%s (INVALID)', [value])).prop('selected', true).prop('disabled', true);
        }

        /** Set the value of a select element. If for some reason the desired option doesn't actually
         * exist, create it but add the text "(INVALID)"
         */
        this.setSelectValue = function(element, value) {
            var select_options = _.map($(element)[0].options, function(opt) {return opt.value});
            if (value) {
                if (!_.contains(select_options, value)) {
                    element.append(invalid_option(value));
                }
            }
            element.val(value);
        };

        /** Configure the MediaItem with a publishedMedia object. */
        this.setData = function(data) {
            name_input.val(data.name);
            id_input.val(data.id);
            this.setSelectValue(glance_input, data.glance || '');
            timeline_checkbox.prop('checked', !!data.timeline);
            if (data.timeline) {
                this.setSelectValue(timeline_tiny_input, data.timeline.tiny);
                this.setSelectValue(timeline_small_input, data.timeline.small);
                this.setSelectValue(timeline_large_input, data.timeline.large);
            }
            else {
                // Default to the first option if the there is no specified timeline data.
                item.find('.edit-media-timeline-options option').prop('selected', false);
                item.find('.edit-media-timeline-options select').find('option:first').prop('selected', true);
            }
        };

        /** Fill all select elements with options for all eligible ResourceIdentifiers. */
        this.setupOptions = function() {
            var identifiers = get_eligible_identifiers();
            item.find(".media-resource-selector").each(function() {
                var select = $(this);
                var value = select.val();
                select.empty();
                if (select.hasClass('media-optional-selector')) {
                    select.append($('<option>').val('').text('-- None --'));
                }
                select.append(_.map(identifiers, function(identifier) {
                    return $('<option>').val(identifier).text(identifier);
                })).val(value);
                if (value && !_.contains(identifiers, value)) {
                    select.find('options').prop('selected', false);
                    select.append(invalid_option(value))
                }
            })
        };

        /** Get this MediaItem's data as a publishedMedia object */
        this.getData = function() {
            var glance = glance_input.val();
            var has_timeline = timeline_checkbox.prop('checked');
            var data = {
                name: name_input.val(),
                id: parseInt(id_input.val(), 10)
            };
            if (glance) data.glance = glance;
            if (has_timeline) {
                data.timeline = {
                    tiny: timeline_tiny_input.val(),
                    small: timeline_small_input.val(),
                    large: timeline_large_input.val()
                }
            }
            return data;
        };

        /** Try to delete the item, but don't hide it unless it has been successfully deleted server-side. */
        this.delete = function() {
            deleting = true;
            return live_form.save().then(function() {
                item.fadeOut('slow', function() {
                    item.remove();
                });
            }).catch(function() {
                deleting = false;
            });
        };

        this.is_deleting = function() {
            return deleting;
        };

        // When the user enables timeline icons, set the tiny one to mirror the glance icon
        timeline_checkbox.change(function() {
            if (timeline_checkbox.is(':checked')) {
                if (glance_input.val()) {
                    timeline_tiny_input.val(glance_input.val());
                }
            }
        });
        // When the user changes the tiny icon, change the glance icon with it if necessary.
        timeline_tiny_input.change(function() {
            if (glance_input.val()) {
                glance_input.val(timeline_tiny_input.val());
            }
        });
        // When the user changes the glance icon, change the tiny icon with it if necessary.
        glance_input.change(function() {
            if (glance_input.val() && timeline_checkbox.is(':checked')) {
                timeline_tiny_input.val(glance_input.val());
            }
        });
        // Set up the delete button
        delete_btn.click(function() {
            self.delete();
        });

        this.setupOptions();
        this.setData({
            name: '',
            id: _.max(media_template.find('.edit-media-id').map(function() {return parseInt(this.value, 10)})) + 1
        });
        if (live_form) live_form.addElement(item, true);
    }

    function sync_with_ycm() {
        if(CloudPebble.Ready) {
            CloudPebble.YCM.updatePublishedMedia(CloudPebble.ProjectInfo.published_media);
        }
    }

    function save_pubished_media(data) {
        var names = _.pluck(data, 'name');
        // Check that all items have names
        if (!_.every(names)) {
            throw new Error(gettext('Identifiers cannot be blank'));
        }
        // Check that all IDs are unique
        if (_.max(_.countBy(data, 'id')) > 1) {
            throw new Error(gettext('Numeric IDs must be unique'));
        }
        // Check that all identifiers are valid
        _.each(names, function(name) {
            if (!REGEXES.c_identifier.test(name)) {
                throw new Error(interpolate(gettext('"%s" is not a valid C identifier. Identifiers must consists of numbers, letters and underscores only.'), [name]))
            }
        });
        return Ajax.Post('/ide/project/' + PROJECT_ID + '/save_published_media', {
            'published_media': JSON.stringify(data)
        }).then(function(result) {
            CloudPebble.ProjectInfo.published_media = data;
            sync_with_ycm();
            return null;
        });
    }

    function save_forms(){
        var data = get_form_data();
        // If not all items have names, cancel saving without displaying an error
        if (!_.every(_.pluck(data, 'name'))) {
            return {incomplete: true};
        }
        // Raise an error if there are any invalid selections
        if ($('select:visible').find('option.media-item-invalid:selected').length > 0) {
            throw new Error(gettext('Please select valid resource IDs for all fields.'));
        }
        return save_pubished_media(data);
    }

    function setup_media_pane() {
        var initial_data = CloudPebble.ProjectInfo.published_media;
        _.each(initial_data, function(data) {
            var item = new MediaItem();
            item.setData(data);
        });

        media_template.find('#add-published-media').click(function() {
            new MediaItem();
        });

        live_form = make_live_settings_form({
            save_function: save_forms,
            on_save: alerts.hide_error,
            error_function: alerts.show_error,
            on_progress_started: alerts.show_progress,
            on_progress_complete: alerts.hide_progress,
            form: media_template.find('form')
        });
        live_form.init();
    }

    function show_media_pane() {
        CloudPebble.Sidebar.SuspendActive();
        if (CloudPebble.Sidebar.Restore("published-media")) {
            return;
        }
        ga('send', 'event', 'project', 'load published-media');
        setup_media_pane();
        CloudPebble.Sidebar.SetActivePane(media_template, {
            id: 'published-media',
            onRestore: function() {
                _.each(get_media_items(), function(item) {
                    item.setupOptions();
                });
            }
        });
    }

    return {
        Show: function() {
            show_media_pane();
        },
        GetPublishedMedia: function() {
            return get_form_data();
        },
        Init: function() {
            var commands = {};
            commands[gettext("Published Media")] = CloudPebble.PublishedMedia.Show;
            CloudPebble.FuzzyPrompt.AddCommands(commands);
            media_template = $('#media-pane-template').remove().removeClass('hide');
            item_template = $('#media-item-template').removeAttr('id').removeClass('hide').remove();
            alerts.init(media_template);
            sync_with_ycm();
        }
    };
})();
