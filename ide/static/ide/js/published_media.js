CloudPebble.PublishedMedia = (function() {
    var ENABLE_INHERETED_PUBLISHED_MEDIA = false;
    var media_template = null;
    var item_template = null;
    var live_form = null;
    var dependency_resources = [];
    var media_pane_setup = false;

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
            $('#main-pane').animate({scrollTop: 0})
        };
        this.hide_error = function hide_error() {
            pane.find('.alert-error').addClass('hide');
        };
        this.init = function(set_pane) {
            pane = set_pane;
        }
    });

    /** Check whether a resource kind is allowed to be referenced in publishedMedia */
    function is_permited_resource_kind(kind) {
        return /^(png|pbi|bitmap|raw)/.test(kind);
    }

    /** Get a list of all Resource IDs which can be referenced by publishedMedia */
    function get_eligible_identifiers() {
        // Grab local resources from CloudPebble.Resources
        var local_identifiers = _.chain(CloudPebble.Resources.GetResources()).filter(function(item) {
            return is_permited_resource_kind(item.kind);
        }).pluck('identifiers').flatten().value();

        // We already have a list of dependency's resources from YCM.
        var dependency_identifiers = _.chain(dependency_resources).filter(function(tuple) {
            // YCM gives a list of resources as a [kind, ID] tuple.
            return is_permited_resource_kind(tuple[0]);
        }).pluck(1).value();

        var final_identifiers = _.uniq(local_identifiers.concat(dependency_identifiers));
        return final_identifiers;
    }

    /** This class sets up and manages a single Published Media item panel. */
    function MediaItem() {
        var self = this;
        var deleting = false;
        var item_form = media_template.find('#media-items');
        var item = item_template.clone().appendTo(item_form).data('item', this);
        var name_input = item.find('.edit-media-name');
        var id_input = item.find('.edit-media-id');
        var glance_input = item.find('.edit-media-glance');
        var timeline_checkbox = item.find('.edit-media-timeline');
        var timeline_tiny_input = item.find('.edit-media-timeline-tiny');
        var timeline_small_input = item.find('.edit-media-timeline-small');
        var timeline_large_input = item.find('.edit-media-timeline-large');
        var delete_btn = item.find('.btn-danger');

        /** Render an invalid option */
        function make_invalid_option(value) {
            return $('<option>').val(value).addClass('media-item-invalid').text(interpolate('%s (INVALID)', [value])).prop('selected', true).prop('disabled', true);
        }

        /** Set the value of a select element. If for some reason the desired option doesn't actually exist, create it but add the text "(INVALID)" */
        this.setSelectValue = function(element, value) {
            var select_options = _.map($(element)[0].options, function(opt) {return opt.value});
            if (value) {
                if (!_.contains(select_options, value)) {
                    element.append(make_invalid_option(value));
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
            if (!this.is_valid()) {
                toggle_sidebar_error(true);
            }
        };

        /** Check that all of this item's resource IDs are in the set of existing resource IDs */
        this.is_valid = function(identifiers) {
            var data = this.getData();
            if (identifiers === undefined) {
                identifiers = get_eligible_identifiers();
            }
            if (data.glance && !_.contains(identifiers, data.glance)) return false;
            if (data.timeline) {
                if (!_.contains(identifiers, data.timeline.tiny)) return false;
                if (!_.contains(identifiers, data.timeline.small)) return false;
                if (!_.contains(identifiers, data.timeline.large)) return false;
            }
            return true;
        };

        /** Fill all select elements with options for all eligible ResourceIdentifiers. */
        this.setupOptions = function(identifiers) {
            if (identifiers === undefined) {
                identifiers = get_eligible_identifiers();
            }
            item.find(".media-resource-selector").each(function() {
                var select = $(this);
                var value = select.find('option:selected').val();
                select.empty();
                if (select.hasClass('media-optional-selector')) {
                    select.append($('<option>').val('').text('-- None --'));
                }
                select.append(_.map(identifiers, function(identifier) {
                    return $('<option>').val(identifier).text(identifier);
                })).val(value);
                if (value && !_.contains(identifiers, value)) {
                    select.find('options').prop('selected', false);
                    select.append(make_invalid_option(value));
                }
            })
        };

        /** Get this MediaItem's data as a publishedMedia object */
        this.getData = function() {
            var glance = glance_input.find('option:selected').val();
            var has_timeline = timeline_checkbox.prop('checked');
            var data = {
                name: name_input.val(),
                id: parseInt(id_input.val(), 10)
            };
            if (glance) data.glance = glance;
            if (has_timeline) {
                data.timeline = {
                    tiny: timeline_tiny_input.find('option:selected').val(),
                    small: timeline_small_input.find('option:selected').val(),
                    large: timeline_large_input.find('option:selected').val()
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
            CloudPebble.Prompts.Confirm(gettext("Do you want to delete this Published Media entry?"), gettext("This cannot be undone."), function() {
                self.delete();
            });
        });

        this.setupOptions();
        this.setData({
            name: '',
            id: _.max(media_template.find('.edit-media-id').map(function() {return parseInt(this.value, 10)})) + 1
        });
        if (live_form) live_form.addElement(item, true);
    }

    /** Send the current publishedMedia to YCM so that they can be autocompleted. */
    function sync_with_ycm() {
        if(CloudPebble.Ready) {
            CloudPebble.YCM.updatePublishedMedia(CloudPebble.ProjectInfo.published_media);
        }
    }

    /** Save an array of published media objects. This does not check that Resource ID references are valid. */
    function save_pubished_media(data) {
        var names = _.pluck(data, 'name');
        // Check that all items have names
        if (!_.every(names)) {
            throw new Error(gettext('Identifiers cannot be blank'));
        }
        // Check that all identifiers are valid
        _.each(names, function(name) {
            if (!REGEXES.c_identifier.test(name)) {
                throw new Error(interpolate(gettext('"%s" is not a valid C identifier. Identifiers must consists of numbers, letters and underscores only.'), [name]))
            }
        });
        return Ajax.Post('/ide/project/' + PROJECT_ID + '/save_published_media', {
            'published_media': JSON.stringify(data)
        }).then(function() {
            CloudPebble.ProjectInfo.published_media = data;
            sync_with_ycm();
            return null;
        });
    }

    /** Save the whole form. If any names are incomplete or resources are invalid, it simply refuses to save without error. */
    function save_forms(event) {
        var data = get_form_data();
        var do_cancel = !event || event.type != 'submit';
        var items = get_media_items();
        var identifiers = get_eligible_identifiers();
        function maybe_error(text) {
            if (do_cancel) return {incomplete: true};
            throw new Error(text);
        }
        // If not all items have names, cancel saving without displaying an error
        if (!_.every(_.pluck(data, 'name'))) {
            return maybe_error(gettext("Published Media must have non-empty identifiers."))
        }

        // Cancel if there are any incomplete items
        if (!_.every(_.map(data, function(item) {
                return !!item.timeline || !!item.glance;
        }))) {
            return maybe_error(gettext("Published Media items must specify glance, timeline icons, or both."))
        }

        // Check that all IDs are unique
        if (_.max(_.countBy(data, 'id')) > 1) {
            return maybe_error(gettext("Published Media IDs must be unique."))
        }

        // Cancel (and show the 'invalid items' icon in the sidebar) if there are any invalid values
        var validity = _.map(items, function(item) {return item.is_valid(identifiers);});
        if (!_.every(validity)) {
            toggle_sidebar_error(true);
            return maybe_error(gettext("You cannot save Published Media items with references to resuorces which do not exist."))
        }

        return save_pubished_media(data).then(function() {
            // If we successfully saved, it implies that there were no invalid references
            // so we can get rid of the sidebar error notification.
            toggle_sidebar_error(false);
        });
    }

    /** Create initial media item forms, and set up interface elements and the live-form mechanism. */
    function setup_media_pane() {
        if (media_pane_setup) return false;
        media_pane_setup = true;

        // Set up the data
        _.each(CloudPebble.ProjectInfo.published_media, function(data) {
            var item = new MediaItem();
            item.setData(data);
        });

        media_template.find('form').submit(function(e) {
            live_form.save(null, e);
            return false;
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
            form: media_template.find('#media-items')
        });
        media_template.find('.media-tool-buttons').removeClass('hide');
        media_template.find('.media-pane-loading').remove();
        live_form.init();
        return true;
    }

    function show_media_pane() {
        CloudPebble.Sidebar.SuspendActive();
        if (CloudPebble.Sidebar.Restore("published-media")) {
            return;
        }
        ga('send', 'event', 'project', 'load published-media');

        CloudPebble.Sidebar.SetActivePane(media_template, {
            id: 'published-media'
        });
    }

    function toggle_sidebar_error(state) {
        $('#sidebar-pane-media').find('.sidebar-error').toggleClass('hide', !state);
    }

    return {
        Show: function() {
            show_media_pane();
        },
        GetPublishedMedia: function() {
            return get_form_data();
        },
        RenameIdentifiers: function(list_of_renames) {
            // We are given a list of Identifier rename tuples as [[old_name, new_name],...]
            // However, there may be conflicts as identical identifiers are renamed to different things, 
            // e.g. [{from: 'A', to: 'THING'}, {from: 'A', to: 'CONFLICT'}, {from: 'B', to: 'RENAME'}]
            // We want to rename any publishedMedia references which are unconflicted, and then flag up conflicts.
            
            // Group by the identifier being renamed
            var items = get_media_items();
            var identifiers = get_eligible_identifiers();
            var grouped = _.chain(list_of_renames).groupBy('from').mapObject(function(renames) {
                return _.uniq(_.pluck(renames, 'to'));
            }).value();

            toggle_sidebar_error(false);
            _.each(items, function(item) {
                var old_data = item.getData();
                var new_data = item.getData();
                item.setupOptions(identifiers);
                _.each(grouped, function(renames, from) {
                    if (renames.length > 1) {
                        // If there is more than one rename, there is a conflict
                    }
                    else {
                        var to = renames[0];
                        // Otherwise, the rename can proceed.
                        if (old_data.glance == from) {
                            new_data.glance = to;
                        }
                        if (old_data.timeline) {
                            _.each(['tiny', 'small', 'large'], function(size) {
                                if (old_data.timeline[size] == from) {
                                    new_data.timeline[size] = to;
                                }
                            });
                        }
                    }
                });
                item.setData(new_data);
            });

            save_forms();
        },
        ValidateIdentifiers: function() {
            CloudPebble.PublishedMedia.RenameIdentifiers([]);
        },
        SetDependencyResources: function(resources) {
            if (ENABLE_INHERETED_PUBLISHED_MEDIA) {
                dependency_resources = resources;
                CloudPebble.PublishedMedia.ValidateIdentifiers();
            }
        },
        Init: function() {
            var commands = {};
            commands[gettext("Published Media")] = CloudPebble.PublishedMedia.Show;
            CloudPebble.FuzzyPrompt.AddCommands(commands);
            media_template = $('#media-pane-template').remove().removeClass('hide');
            item_template = $('#media-item-template').removeAttr('id').removeClass('hide').remove();
            alerts.init(media_template);
            CloudPebble.YCM.initialise().then(function(data) {
                if (ENABLE_INHERETED_PUBLISHED_MEDIA && data.resources) {
                    dependency_resources = data.resources;
                }
            }).finally(function() {
                if (!setup_media_pane()) {
                    CloudPebble.PublishedMedia.ValidateIdentifiers();
                }
            });
        }
    };
})();
