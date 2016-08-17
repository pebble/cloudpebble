CloudPebble.PublishedMedia = (function() {
    var media_template = null;
    var item_template = null;
    var live_form = null;

    function get_form_data() {
        return media_template.find('.media-item').map(function() {
            return $(this).data('item').getData();
        }).toArray();
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

    function get_eligable_identifiers() {
        return _.chain(CloudPebble.Resources.GetResources()).filter(function(item) {
            return /^(png|pbi|bitmap|raw)/.test(item.kind);
        }).pluck('identifiers').flatten().uniq().value();
    }

    function MediaItem() {
        var item_form = media_template.find('form');
        var item = item_template.clone().appendTo(item_form).data('item', this);
        var name_input = item.find('.edit-media-name');
        var id_input = item.find('.edit-media-id');
        var glance_input = item.find('.edit-media-glance');
        var timeline_checkbox = item.find('.edit-media-timeline');
        var timeline_tiny_input = item.find('.edit-media-timeline-tiny');
        var timeline_small_input = item.find('.edit-media-timeline-small');
        var timeline_large_input = item.find('.edit-media-timeline-large');

        this.setData = function(data) {
            name_input.val(data.name);
            id_input.val(data.id);
            glance_input.val(data.glance || '');
            timeline_checkbox.prop('checked', !!data.timeline);
            if (data.timeline) {
                timeline_tiny_input.val(data.timeline.tiny);
                timeline_small_input.val(data.timeline.small);
                timeline_large_input.val(data.timeline.large);
            }
            else {
                // Default to the first option if the there is no specified timeline data.
                item.find('.edit-media-timeline-options option').prop('selected', false);
                item.find('.edit-media-timeline-options select').find('option:first').prop('selected', true);
            }
        };

        this.setupOptions = function() {
            var identifiers = get_eligable_identifiers();
            item.find(".media-resource-selector").each(function() {
                var select = $(this).empty();
                var value = select.val();
                if (select.hasClass('media-optional-selector')) {
                    select.append($('<option>').val('').text('-- None --'));
                }
                select.append(_.map(identifiers, function(identifier) {
                    return $('<option>').val(identifier).text(identifier);
                })).val(value);
            })
        };

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

        this.setupOptions();
        this.setData({
            name: '',
            id: _.max(media_template.find('.edit-media-id').map(function() {return parseInt(this.value, 10)})) + 1
        });
        if (live_form) live_form.addElement(item, true);
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
            // return CloudPebble.YCM.updateDependencies(result.dependencies);
        });
    }

    function save_forms(){
        var data = get_form_data();
        // If not all items have names, cancel saving without displaying an error
        if (!_.every(_.pluck(data, 'name'))) {
            return {incomplete: true};
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
            id: 'published-media'
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

            // CloudPebble.YCM.initialise().then(function(data) {
            //     if (data.libraries) {
            //         update_header_file_list(data.libraries)
            //     }
            // }).finally(function() {
            //     alerts.hide_progress();
            // });
        }
    };
})();
