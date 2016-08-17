CloudPebble.PublishedMedia = (function() {
    var media_template = null;
    var item_template = null;

    function get_default_data() {
            return {
                name: '',
                id: make_new_id()
            }
        }

    function make_new_id() {
        return _.max(media_template.find('.edit-media-id').map(function() {return parseInt(this.value, 10)})) + 1;
    }

    function get_form_data() {
        return media_template.find('.media-item').map(function() {
            var item = $(this);
            var glance = item.find('.edit-media-glance').val();
            var has_timeline = item.find('.edit-media-timeline').prop('checked');
            var data = {
                name: item.find('.edit-media-name').val(),
                id: parseInt(item.find('.edit-media-id').val(), 10)
            };
            if (glance) data.glance = glance;
            if (has_timeline) {
                data.timeline = {
                    tiny: item.find('.edit-media-timeline-tiny').val(),
                    small: item.find('.edit-media-timeline-small').val(),
                    large: item.find('.edit-media-timeline-large').val()
                }
            }
            return data;
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

    function make_new_media_item() {
        var item_form = media_template.find('form');
        var new_item = item_template.clone().appendTo(item_form);
        set_form_options(new_item);
        set_media_item_data(new_item, publishedMedia.get_default_data());
        return new_item;
    }

    function set_media_item_data(element, data) {
        element.find('.edit-media-name').val(data.name);
        element.find('.edit-media-id').val(data.id);
        element.find('.edit-media-glance').val(data.glance || '');
        element.find('.edit-media-timeline').prop('checked', !!data.timeline);
        if (data.timeline) {
            element.find('.edit-media-timeline-tiny').val(data.timeline.tiny);
            element.find('.edit-media-timeline-small').val(data.timeline.small);
            element.find('.edit-media-timeline-large').val(data.timeline.large);
        }
        else {
            // Default to the first option if the there is no specified timeline data.
            element.find('.edit-media-timeline-options option').prop('selected', false);
            element.find('.edit-media-timeline-options select').find('option:first').prop('selected', true);
        }
    }

    function set_form_options(parent) {
        var identifiers = get_eligable_identifiers();
        parent.find(".media-resource-selector").each(function() {
            var select = $(this).empty();
            var value = select.val();
            if (select.hasClass('media-optional-selector')) {
                select.append($('<option>').val('').text('-- None --'));
            }
            select.append(_.map(identifiers, function(identifier) {
                return $('<option>').val(identifier).text(identifier);
            })).val(value);
        })
    }

    function setup_media_pane() {
        var initial_data = [{
            name: 'BLAH',
            id: 0,
            glance: 'THING',
            timeline: {
                tiny: 'THING',
                small: 'THING2',
                large: 'THING2'
            }
        }];
        _.each(initial_data, function(item) {
            var entry = make_new_media_item();
            set_media_item_data(entry, item);
        });

        media_template.find('#add-published-media').click(function() {
            make_new_media_item();
        });
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
            return publishedMedia.get_data();
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
