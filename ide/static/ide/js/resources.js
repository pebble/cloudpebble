CloudPebble.Resources = (function() {
    var project_resources = {};
    var preview_count = 0;

    var TAG_MONOCHROME = 1;
    var TAG_COLOUR = 2;
    var TAG_RECT = 3;
    var TAG_ROUND = 4;
    var TAG_APLITE = 5;
    var TAG_BASALT = 6;
    var TAG_CHALK = 7;
    var TAG_DIORITE = 8;
    var TAG_EMERY = 9;
    var TAG_MIC = 10;
    var TAG_STRAP = 11;
    var TAG_STRAPPOWER = 12;
    var TAG_COMPASS = 13;
    var TAG_HEALTH = 14;
    var TAG_144W = 15;
    var TAG_168H = 16;
    var TAG_180W = 17;
    var TAG_180H = 18;
    var TAG_200W = 19;
    var TAG_228H = 20;

    var TAGS = {
        color: {name: gettext("Colour"), id: TAG_COLOUR, excludes: [TAG_MONOCHROME, TAG_APLITE, TAG_DIORITE]},
        bw: {name: gettext("Monochrome"), id:TAG_MONOCHROME,  excludes: [TAG_COLOUR, TAG_BASALT, TAG_CHALK, TAG_EMERY, TAG_ROUND]},
        aplite: {name: "Aplite", id: TAG_APLITE, excludes: [TAG_BASALT, TAG_CHALK, TAG_DIORITE, TAG_EMERY, TAG_ROUND, TAG_COLOUR]},
        basalt: {name: "Basalt", id: TAG_BASALT, excludes: [TAG_APLITE, TAG_CHALK, TAG_DIORITE, TAG_EMERY, TAG_ROUND, TAG_MONOCHROME]},
        chalk: {name: "Chalk", id: TAG_CHALK, excludes: [TAG_APLITE, TAG_BASALT, TAG_DIORITE, TAG_EMERY, TAG_MONOCHROME, TAG_RECT]},
        diorite: {name: "Diorite", id: TAG_DIORITE, excludes: [TAG_APLITE, TAG_BASALT, TAG_CHALK, TAG_EMERY, TAG_COLOUR, TAG_ROUND]},
        emery: {name: "Emery", id: TAG_EMERY, excludes: [TAG_APLITE, TAG_BASALT, TAG_CHALK, TAG_DIORITE, TAG_ROUND, TAG_MONOCHROME]},
        round: {name: gettext("Round"), id: TAG_ROUND, excludes: [TAG_RECT, TAG_MONOCHROME, TAG_APLITE, TAG_BASALT, TAG_DIORITE, TAG_EMERY]},
        rect: {name: gettext("Rectangular"), id: TAG_RECT, excludes: [TAG_ROUND, TAG_CHALK]},
        mic: {name: gettext("Microphone"), id: TAG_MIC, excludes: [TAG_APLITE]},
        strap: {name: gettext("Smartstrap"), id: TAG_STRAP, excludes: [TAG_APLITE]},
        strappower: {name: gettext("Smartstrap Power"), id: TAG_STRAPPOWER, excludes: [TAG_APLITE, TAG_DIORITE, TAG_MONOCHROME]},
        compass: {name: gettext("Compass"), id: TAG_COMPASS, excludes: [TAG_DIORITE]},
        health: {name: gettext("Health"), id: TAG_HEALTH, excludes: [TAG_APLITE]},
        '144w': {name: gettext("Width: 144 pixels"), id: TAG_144W, excludes: [TAG_180W, TAG_200W, TAG_180H, TAG_228H, TAG_CHALK, TAG_EMERY, TAG_ROUND]},
        '168h': {name: gettext("Height: 168 pixels"), id: TAG_168H, excludes: [TAG_180W, TAG_200W, TAG_180H, TAG_228H, TAG_CHALK, TAG_EMERY, TAG_ROUND]},
        '180w': {name: gettext("Width: 180 pixels"), id: TAG_180W, excludes: [TAG_144W, TAG_168H, TAG_200W, TAG_228H, TAG_APLITE, TAG_BASALT, TAG_DIORITE, TAG_EMERY, TAG_RECT, TAG_MONOCHROME]},
        '180h': {name: gettext("Height: 180 pixels"), id: TAG_180H, excludes: [TAG_144W, TAG_168H, TAG_200W, TAG_228H, TAG_APLITE, TAG_BASALT, TAG_DIORITE, TAG_EMERY, TAG_RECT, TAG_MONOCHROME]},
        '200w': {name: gettext("Width: 200 pixels"), id: TAG_200W, excludes: [TAG_144W, TAG_168H, TAG_180W, TAG_180H, TAG_APLITE, TAG_BASALT, TAG_CHALK, TAG_DIORITE, TAG_ROUND, TAG_MONOCHROME]},
        '228h': {name: gettext("Height: 228 pixels"), id: TAG_228H, excludes: [TAG_144W, TAG_168H, TAG_180W, TAG_180H, TAG_APLITE, TAG_BASALT, TAG_CHALK, TAG_DIORITE, TAG_ROUND, TAG_MONOCHROME]}
    };

    var PLATFORMS = {
        aplite: [TAG_APLITE, TAG_MONOCHROME, TAG_RECT, TAG_COMPASS, TAG_144W, TAG_168H],
        basalt: [TAG_BASALT, TAG_COLOUR, TAG_RECT, TAG_STRAP, TAG_STRAPPOWER, TAG_COMPASS, TAG_HEALTH, TAG_MIC, TAG_144W, TAG_168H],
        chalk: [TAG_CHALK, TAG_COLOUR, TAG_ROUND, TAG_STRAP, TAG_STRAPPOWER, TAG_COMPASS, TAG_HEALTH, TAG_MIC, TAG_180W, TAG_180H],
        diorite: [TAG_DIORITE, TAG_MONOCHROME, TAG_RECT, TAG_STRAP, TAG_HEALTH, TAG_MIC, TAG_144W, TAG_168H],
        emery: [TAG_EMERY, TAG_COLOUR, TAG_RECT, TAG_STRAP, TAG_STRAPPOWER, TAG_COMPASS, TAG_HEALTH, TAG_200W, TAG_228H]
    };

    /**
     * Get the tag data (from TAGS) for the tag with a specific human-readable name
     * @param {string} name
     */
    function get_tag_data_for_tag_name(name) {
        return _.findWhere(TAGS, {name: name});
    }

    /**
     * Get the tag data (from TAGS) for the tag with a specific numeric ID.
     * @param {Number} id
     */
    function get_tag_data_for_id(id) {
        return _.findWhere(TAGS, {id: id});
    }

    /**
     * Get the the list of target platforms currently checked in all targetPlatforms interfaces in the pane,
     * or null if all target platform checkboxes are disabled.
     * @param {jQuery|HTMLElement} pane element containing the form
     * @returns {Array|null}
     */
    function get_target_platforms(pane) {
        pane = $(pane);
        // Return null any IDs in the pane have no targetPlatforms enabled
        if (pane.find('.edit-resource-target-platforms-enabled').is(":not(:checked)")) {
            return null;
        }
        // Otherwise, return the union of all targetPlatforms set in the pane.
        else {
            return _.filter(_.keys(PLATFORMS), function(platform) {
                return pane.find('.edit-resource-target-'+platform).is(":checked");
            });
        }
    }

    /**
     * Get the image preview box whose tag editor has a specific set of tags typed in
     * @param tags Array of tags to search for
     * @returns {jQuery}
     */
    function get_image_preview_for_tag_input(tags) {
        // Given a set of tags currently typed in one of the boxes,
        // which image preview element does it belong to?
        return $('.text-wrap input').filter(function() {
            return ((_.isEqual(JSON.parse($(this).val()), tags)) && $(this).siblings('textarea').is(':enabled'));
        }).parents('.well');
    }

    /**
     * Extract out the currently-entered tag values
     * @param {jQuery|HTMLElement} parent element containing
     * @param {bool} should_include_new_file_tags Set true to include the tags in the New File box
     * @param {bool} do_sort Set true to sort each set of tags
     * @returns {Array}
     */
    function get_new_tag_values(parent, should_include_new_file_tags, do_sort) {
        return $.makeArray($(parent).find('.text-wrap input').filter(function() {
            // Only check the uploading-file tags if we're uploading a file
            var is_new_file_well = $(this).closest('#edit-resource-new-file').length;
            return (!is_new_file_well || should_include_new_file_tags);
        }).map(function(i, input) {
            // Just extract the tag numbers.
            var tags = [];
            if (CloudPebble.ProjectInfo.sdk_version != "2") {
                tags = JSON.parse(input.value);
            }
            if (do_sort) tags.sort();
            return [tags];
        }));
    }

    /**
     * Refresh the image-per-platform previews and platform-for-resource labels.
     * Throttled to 100ms so that repeated calls don't cause flashes.
     * @paramn {jQuery|HTMLElement} pane element containing resource interface
     */
    var update_platform_labels = _.throttle(function(pane) {
        pane = $(pane);

        // We only include the tags for a file being uploaded if there actually is a file being uploaded
        var include_uploader = pane.find('#edit-resource-new-file textarea').is(':enabled');

        // Get the tags currently typed in each tag editor
        var new_tag_values = get_new_tag_values(pane, include_uploader, false);

        // We empty all tags and recreate them from scratch
        pane.find('.label-list').empty();

        // If we're not targeting specific platforms, all platforms are target platforms
        var target_platforms = get_target_platforms(pane) || _.keys(PLATFORMS);

        // Start by assuming that no platforms are being targeted.
        pane.find(".image-platform-preview img").hide();
        pane.find(".image-platform-preview span").text('Not targeted').removeClass('conflict');

        // Go through each targeted platforms and set up its previews
        _.each(target_platforms, function(platform_name) {
            var per_platform_preview_pane = pane.find("#resource-image-preview-for-"+platform_name);
            try {
                // First add in the platform labels
                var tags_for_this_platform = get_resource_for_platform(new_tag_values, platform_name);
                var preview_pane = get_image_preview_for_tag_input(tags_for_this_platform);
                var list = preview_pane.find('.label-list');
                $("<span>").text(platform_name).addClass('label').attr('title', null).addClass('label-'+platform_name).appendTo(list);
                // Then update the per-platform preview images
                var img = preview_pane.find('img').first();
                var file = preview_pane.find('input[type="file"]').first();
                if (tags_for_this_platform == null) {
                    per_platform_preview_pane.find('img').hide();
                    per_platform_preview_pane.find("span").text('Unmatched').addClass('conflict');
                }
                else if (img && img.length > 0) {
                    per_platform_preview_pane.find('img').show().attr('src', img.attr('src'));
                    per_platform_preview_pane.find('span').text("");
                }
                else if (file && file[0] && file[0].files.length > 0) {
                    per_platform_preview_pane.find('img').hide();
                    per_platform_preview_pane.find('span').text("New file");
                }
            }
            catch (err) {
                // If there are any conflicts, show them
                if (err.conflicts) {
                    per_platform_preview_pane.find('img').hide();
                    per_platform_preview_pane.find('span').text("Conflict!").addClass('conflict');
                    _.each(err.conflicts, function(tags) {
                        var list = get_image_preview_for_tag_input(tags).find('.label-list').empty();
                        $("<span>").text(gettext("conflict")).attr('title', err.message).addClass('label').addClass('label-error').appendTo(list);
                    });
                }
                else {
                    throw err;
                }
            }
        });
    }, 100, {leading: false});

    var add_resource = function(resource) {
        var li = CloudPebble.Sidebar.AddResource(resource, function() {
            edit_resource(resource);
        });
        update_resource(resource);
        CloudPebble.Settings.AddResource(resource);
    };

    var update_resource = function(resource) {
        project_resources[resource.file_name] = resource;
        CloudPebble.FuzzyPrompt.SetCurrentItemName(resource.file_name);
        if(resource.kind == 'png-trans' && resource.identifiers.length == 1) {
            var identifier = resource.identifiers[0];
            resource.identifiers = [identifier + '_WHITE', identifier + '_BLACK'];
        }
        var popover_content = _.map(resource.identifiers, function(identifier) {
            return $('<span>').text(identifier).html()
        }).join('<br>');
        CloudPebble.Sidebar.SetPopover('resource-' + resource.id, ngettext('Identifier', 'Identifiers', resource.identifiers.length), popover_content);
        // We need to update code completion so it can include these identifiers.
        // However, don't do this during initial setup; the server handle it for us.
        if(CloudPebble.Ready) {
            CloudPebble.YCM.updateResources(project_resources);
        }
    };

    var PEBBLE_PPI = 175.2;

    function process_file(kind, input) {
        var files = $(input)[0].files;
        var file = (files.length > 0) ? files[0] : null;
        if(files.length != 1) {
            return null;
        }
        if(_.contains(['bitmap', 'png', 'png-trans', 'pbi'], kind) && file.type != "image/png") {
            throw new Error(gettext("You must upload a PNG image."));
        }
        return file;
    }

    /**
     * Given the tags for each variant and a desired platform, figure out which variant will run.
     * Returns null if there is no match. Throws an exception if there is a specificity conflict for the platform.
     * @param tag_values Array of arrays of tag IDs.
     * @param platform_name Name of platform to check
     * @returns {Array|null}
     */
    function get_resource_for_platform(tag_values, platform_name) {
        // Find all variants with tags which fully apply to this platform.
        var platform_tags = PLATFORMS[platform_name];
        var filtered_tags = _.filter(tag_values, function(var_tags) {
            return _.difference(var_tags, platform_tags).length == 0;
        });
        // Is there more than one 'most-specific' variant for this platform?
        var lengths = _.pluck(filtered_tags, 'length');
        var max_len = _.max(lengths);
        var conflicts = _.chain(_.zip(filtered_tags, lengths)).filter(function(pair) {
            return pair[1] == max_len;
        }).pluck(0).value();

        // If there is a conflict, complain.
        if (conflicts.length > 1) {
            var conflict_string = _.map(conflicts, function(conflict_tags) {
                return "("+_.chain(conflict_tags).map(get_tag_data_for_id).pluck('name').join(', ')+")";
            }).join(gettext(' and '));
            var err = new Error(interpolate(gettext("Conflict for platform '%s'. The variants with tags %s have the same specificity."), [platform_name, conflict_string]));
            err.conflicts = conflicts;
            throw err;
        }
        // There may be no resource for this platform
        if (conflicts.length == 0) {
            return null;
        }
        // Otherwise, return the variant for this platform
        return conflicts[0];
    }

    function save_resource(url, parameters) {
        var kind = parameters.kind;
        var resources = parameters.resources;
        var file = parameters.file;
        var new_tags = parameters.new_tags;
        var is_new = parameters.is_new;
        var variant_tags = parameters.variant_tags;
        var name = parameters.name;
        var replacement_map = parameters.replacement_map;
        var replacements_files = parameters.replacements_files;
        var form_data = new FormData();

        // Build replacement file map
        form_data.append("kind", kind);
        form_data.append("resource_ids", JSON.stringify(resources));
        if (file) {
            var arr = $.makeArray(new_tags)[0];
            form_data.append("new_tags", JSON.stringify(arr ? arr[1] : []));
            form_data.append("file", file);
        }
        if (!is_new) {
            form_data.append("variants", JSON.stringify($.makeArray(variant_tags)));
        }
        form_data.append("file_name", name);
        form_data.append("replacements", JSON.stringify(replacement_map));
        _.each(replacements_files, function (file) {
            form_data.append("replacement_files[]", file);
        });


        return Ajax.Ajax({
            url: url,
            type: "POST",
            data: form_data,
            processData: false,
            contentType: false,
            dataType: 'json'
        });
    }

    var get_resource_form_data = function(form, is_new, current_filename) {
        var kind = form.find('#edit-resource-type').val();
        var name = form.find("#edit-resource-file-name").val();
        var file;

        // Process the file to be uploaded
        file = process_file(kind, form.find('#edit-resource-file'));

        // Check that the user uploaded a new file for a new resource
        if(is_new && !file) {
            throw new Error(gettext("You must upload a resource."));
        }

        // Check for file name conflicts
        if (_.has(project_resources, name) && name !== current_filename) {
            throw new Error(interpolate(gettext("A resource called '%s' already exists in the project."), [name]));
        }

        // Validate the file name
        if (!REGEXES.resource_file_name.test(name)) {
            throw new Error(gettext("You must provide a valid filename. Only alphanumerics and characters in the set \"_(). -\" are allowed."));
        }

        // Extract the tags from each variant which has changed
        function extract_tags(element) {
            return element
                .map(function (i, input) {
                    return [[input.name.split('-')[1], input.value]];
                })
                .filter(function (i, val) {
                    return (val[0] !== val[1].slice(1, -1));
                })
                .map(function (i, val) {
                    return [[val[0], JSON.parse(val[1])]]
                });
        }

        // Validate the tags!
        var new_tag_values = get_new_tag_values(form, !!file, true);

        if (CloudPebble.ProjectInfo.sdk_version == "2" && new_tag_values.length > 1) {
            throw new Error(gettext("SDK 2 projects do not support multiple files per resource. Please delete extra files."));
        }

        // Ensure that all variants' tags are unique
        if (_.uniq(_.map(new_tag_values, JSON.stringify)).length != new_tag_values.length) {
            throw new Error(gettext("Each variant must have a different set of tags"));
        }

        var resources = [];

        var resource_ids = {};
        $.each(form.find('.resource-id-group-single'), function(index, value) {
            value = $(value);
            var resource_id = value.find('.edit-resource-id:visible').val();
            var resource = {'id': resource_id};

            // Check the resource ID
            if(resource_id === '' || !validate_resource_id(resource_id)) {
                throw new Error(gettext("Invalid resource identifier. Use only letters, numbers and underscores."));
            }

            // Extract target platforms and verify that they're valid
            var target_platforms = get_target_platforms(value);
            var targeted_platform_tags = (target_platforms!== null ? _.pick(PLATFORMS, target_platforms) : PLATFORMS);
            if (_.isEqual(target_platforms, [])) {
                throw new Error(gettext("You cannot specifically target no platforms."));
            }

            // Validate the tags: detect ambiguities and check that each targeted platform has a matching variant
            for (var platform_name in targeted_platform_tags) {
                if (get_resource_for_platform(new_tag_values, platform_name) == null) {
                    throw new Error (interpolate(gettext("There is no variant matching the target platform '%s'."), [platform_name]));
                }
            }
            resource.target_platforms = target_platforms;

            // Add in font-specific per-ID settings, if applicable
            if (kind == 'font') {
                var regex = value.find('.edit-resource-regex').val();
                var tracking = parseInt(value.find('.edit-resource-tracking').val() || '0', 10);
                var compat = value.find('.font-compat-option').val() || null;
                if(!/[0-9]+$/.test(resource_id)) {
                    throw new Error(interpolate(gettext("Font resource identifiers must end with the desired font size, e.g. %s_24"), [resource_id]));
                }
                if(tracking != tracking) {
                    throw new Error(gettext("Tracking must be an integer."));
                }
                _(resource).extend({'regex': regex, 'tracking': tracking, 'compatibility': compat})
            }

            // Add in bitmap-specific per-ID settings, if applicable
            if (kind == 'bitmap') {
                _(resource).extend({
                    memory_format: value.find('.bitmap-memory-format-option').val() || null,
                    storage_format: value.find('.bitmap-storage-format-option').val() || null,
                    space_optimisation: value.find('.bitmap-space-optimisation-option').val() || null
                });
            }

            resource_ids[resource_id] = true;
            resources.push(resource);
        });
        if(resources.length === 0) {
            throw new Error(gettext("You must specify at least one resource."));
        }

        var variant_tags = extract_tags(form.find('#edit-resource-previews .text-wrap input'));
        var new_tags = extract_tags(form.find('#edit-resource-new-file .text-wrap input'));

        var replacements_files = [];
        var replacement_map = [];
        $.each(form.find('.edit-resource-replace-file'), function() {
            var file;
            file = process_file(kind, this);
            if (file !== null) {
                var tags = $(this).parents('.image-resource-preview-pane, .raw-resource-preview-pane').find('.text-wrap input').val().slice(1, -1);
                replacement_map.push([tags, replacements_files.length]);
                replacements_files.push(file);
            }
        });
        return {
            kind: kind,
            resources: resources,
            file: file,
            new_tags: new_tags,
            is_new: is_new,
            variant_tags: variant_tags,
            name: name,
            replacement_map: replacement_map,
            replacements_files: replacements_files
        };
    };

    var process_resource_form = function(form, is_new, current_filename, url) {
        var report_error = function(message) {
            form.find('.alert:first').removeClass("hide").text(message);
            $("#main-pane").animate({ scrollTop: 0 }, "fast");
        };
        var remove_error = function() {
            form.find('.alert:first').addClass("hide");
        };
        var disable_controls = function() {
            form.find('input, button, select').attr('disabled', 'disabled');
        };
        var enable_controls = function() {
            form.find('input, button, .resource-id-group-single select').removeAttr('disabled');
            if(is_new) {
                form.find('select').removeAttr('disabled');
            }
        };

        remove_error();
        disable_controls();
        ga('send', 'event', 'resource', 'save');
        // TODO: CHECK THIS IS CORRECT!!!!!
        return Promise.resolve().then(function() {
            return get_resource_form_data(form, is_new, current_filename);
        }).then(function(resource_data) {
            console.log(resource_data);
            return save_resource(url, resource_data);
        }).then(function(data) {
            return data.file;
        }).catch(function(err) {
            report_error(err.toString());
            throw err;
        }).finally(function() {
            enable_controls();
        });
    };

    var edit_resource = function(resource) {
        CloudPebble.FuzzyPrompt.SetCurrentItemName(resource.file_name);
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('resource-' + resource.id)) return;
        ga('send', 'event', 'resource', 'open');

        CloudPebble.ProgressBar.Show();
        Ajax.Get("/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/info").then(function(data) {
            var resource = data.resource;
            var pane = prepare_resource_pane();

            var list_entry = $('#sidebar-pane-resource-' + resource.id);
            if(list_entry) {
                list_entry.addClass('active');
            }

            CloudPebble.Sidebar.SetActivePane(pane, {
                id: 'resource-' + resource.id,
                onRestore: _.partial(restore_pane, pane)
            });
            pane.find('#edit-resource-type').val(resource.kind).attr('disabled', 'disabled');
            pane.find('#edit-resource-type').change();

            var save = function(e) {
                if (e) e.preventDefault();
                process_resource_form(form, false, resource.file_name, "/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/update").then(function(data) {
                    delete project_resources[resource.file_name];
                    // Update our information about the resource.
                    update_resource(data);
                    resource = project_resources[data.file_name];

                    // Set the resource's sidebar name
                    generate_resource_previews(resource.kind);
                    CloudPebble.Sidebar.SetItemName('resource', data.id, data.file_name);

                    if(resource.kind == 'font') {
                        resource.family = null;
                        $.each(pane.find('.resource-id-group-single'), function(index, group) {
                            update_font_preview($(group));
                        });
                    }

                    // Clear and disable the upload-file form
                    pane.find('#edit-resource-new-file input').val('');
                    pane.find('#edit-resource-new-file textarea').textext()[0].tags().empty().core().enabled(false);
                    pane.find('#edit-resource-new-file').toggleClass('file-present', false);
                    CloudPebble.Sidebar.ClearIcon('resource-'+resource.id);
                    live_form.clearIcons();

                    // Only show the delete-identifiers button if there is more than one ID.
                    pane.find('.btn-delidentifier').toggle(resource.resource_ids.length > 1);
                }).catch(function() {/* ignore failure */});;
            };

            // Generate a preview.

            var generate_resource_previews = function(kind) {
                var previews = pane.find('#edit-resource-previews');
                previews.empty();
                _.each(resource.variants, function (tags) {
                    var variant_string;
                    var template_name;
                    if (tags.length == 0) {
                        variant_string = '0';
                    }
                    else {
                        variant_string = tags.join(',');
                    }
                    switch (kind) {
                        case 'bitmap':
                        case 'png':
                        case 'png-trans':
                        case 'pbi':
                            template_name = 'image';
                            break;
                        case 'raw':
                        case 'font':
                            template_name = 'raw';
                            break;
                    }

                    // Add a cache-breaking query string to the end of the URL to ensure the image reloads
                    var preview_url = '/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/' + variant_string + '/get?'+new Date().getTime();
                    var preview_pane = pane.find('#edit-'+template_name+'-resource-preview-template > div').clone();
                    preview_pane.appendTo(previews).hide();

                    if (template_name == 'image') {
                        var preview_img = preview_pane.find('.image-resource-preview img');
                        preview_img.attr('src', preview_url);
                        var dimensions = preview_pane.find('.image-resource-preview-dimensions');
                        preview_pane.show();
                        build_tags_editor(pane, preview_pane.find('.resource-tags'), tags) ;

                        preview_img.load(function () {
                            dimensions.text(this.naturalWidth + ' x ' + this.naturalHeight);
                        }).error(function() {
                            dimensions.text("Image failed to load");
                        });
                    }
                    if (template_name == 'raw') {
                        preview_pane.find('.resource-download-link').removeClass('hide').find('a').attr('href', preview_url);
                        preview_pane.show();
                        build_tags_editor(pane, preview_pane.find('.resource-tags'), tags) ;
                    }

                    preview_pane.find('.btn-delvariant').click(function() {
                        CloudPebble.Prompts.Confirm(gettext("Do you want to delete this resource variant?"), gettext("This cannot be undone."), function () {
                            pane.find('input, button, select').attr('disabled', true);

                            Ajax.Post('/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/' + variant_string + '/delete').then(function (data) {
                                // Regenerate all the previews from scratch.
                                // It's the easiest way.
                                resource.variants = data.resource.variants;
                                project_resources[resource.file_name].variants = resource.variants;
                                generate_resource_previews(resource.kind);
                                ga('send', 'event', 'resource', 'delete')
                            }).catch(function(error) {
                                alert(error.toString())
                            }).finally(function() {
                                pane.find('input, button, select').removeAttr('disabled');
                            });
                        });
                    });
                });
                if (CloudPebble.ProjectInfo.sdk_version == '2' && resource.variants.length > 0) {
                    pane.find('#edit-resource-new-file').hide();
                }
                // Only show the delete-variant buttons if there's more than one variant
                pane.find('.btn-delvariant').toggle(resource.variants.length > 1);
            };

            generate_resource_previews(resource.kind);

            var update_font_preview = function(group) {
                group.find('.font-preview').remove();
                var regex_str = group.find('.edit-resource-regex').val();
                var id_str = group.find('.edit-resource-id').val();
                var preview_regex = new RegExp('');
                try {
                    preview_regex = new RegExp(regex_str ? regex_str : '.', 'g');
                    group.find('.font-resource-regex-group').removeClass('error').find('.help-block').text(gettext("A PCRE regular expression that restricts characters."));
                } catch (e) {
                    group.find('.font-resource-regex-group').addClass('error').find('.help-block').text(e);
                }
                var tracking = parseInt(group.find('.edit-resource-tracking').val(), 10) || 0;

                _.each(resource.variants, function (tags) {
                    var row = $('<div class="control-group font-preview"><label class="control-label">' + gettext('Preview') + '</label>');
                    var preview_holder = $('<div class="controls">');
                    var font_tag_preview = $('<div class="font-tag-preview">').appendTo(preview_holder).text(gettext("For ") + (
                        _.chain(tags)
                            .map(get_tag_data_for_id)
                            .pluck('name').value()
                            .join(', ')
                        || gettext("untagged")) + gettext(" file")
                    );
                    var preview = $('<div>').appendTo(preview_holder);
                    var line = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@#$%^& *()_+[]{}\\|;:\'"<>?`'.match(preview_regex) || []).join('');
                    var font_size = id_str.match(/[0-9]+$/)[0];

                    preview.text(line);
                    // Officially, a CSS pixel is defined as one pixel at 96 dpi.
                    // 96 / PEBBLE_PPI should thus be correct.
                    // We use 'transform' to work around https://bugs.webkit.org/show_bug.cgi?id=20606
                    preview.css({
                        'font-family': CloudPebble.Resources.GetFontFamily(resource, tags),
                        'font-size': font_size + 'px',
                        'line-height': font_size + 'px',
                        'letter-spacing': tracking + 'px',
                        'transform': 'scale(' + (96 / PEBBLE_PPI) + ')',
                        'transform-origin': '0 0',
                        'display': 'inline-block',
                        'border': (2 * (PEBBLE_PPI / 96)) + 'px solid #767676',
                        'padding': '5px',
                        'border-radius': '5px',
                        'background-color': 'white',
                        'color': 'black',
                        'word-wrap': 'break-word',
                        'width': 'calc(100% * 1/0.547945)'
                    });
                    // The parent element doesn't take the CSS transform in to account when calculating its own height
                    // based on it children, so there is a large gap left underneath.
                    // We fix this calculating the height of the preview's empty space and subtracting it from the
                    // parent element's margin.
                    _.defer(function() {
                        preview_holder.css({
                            'margin-bottom': (60 - (preview.height() * (1 - 96/PEBBLE_PPI))) +'px'
                        })
                    });

                    row.append(preview_holder);
                    group.append(row);
                });
            };

            var initialise_resource_id_group = function(group, resource) {
                group.find('.btn-delidentifier').click(function() {
                    CloudPebble.Prompts.Confirm(gettext("Do you want to this resource identifier?"), gettext("This cannot be undone."), function () {
                        group.remove();
                        CloudPebble.Sidebar.SetIcon('resource-'+resource.id, 'edit');
                        save();
                    });
                });
            };

            var template = pane.find('.resource-id-group-single').detach();
            var parent = $('#resource-id-group').removeClass('hide');
            $.each(resource.resource_ids, function(index, value) {
                var group = template.clone();
                group.removeClass('hide').attr('id','');
                group.find('.edit-resource-id').val(value.id);
                if (resource.kind == 'font') {
                    group.find('.edit-resource-regex').val(value.regex);
                    group.find('.edit-resource-tracking').val(value.tracking || '0');
                    group.find('.font-compat-option').val(value.compatibility || "");
                    update_font_preview(group);
                    group.find('input[type=text], input[type=number]').on('input', function() {
                        update_font_preview(group);
                    });
                    group.find('.non-font-only').remove();
                } else {
                    group.find('.font-only').remove();
                }

                if (resource.kind == 'bitmap') {
                    group.find('.bitmap-memory-format-option').val(value.memory_format|| "");
                    group.find('.bitmap-storage-format-option').val(value.storage_format || "");
                    group.find('.bitmap-space-optimisation-option').val(value.space_optimisation || "");
                }
                else {
                    group.find('.bitmap-only').remove()
                }

                var has_target_platforms = _.isArray(value["target_platforms"]);
                if (has_target_platforms) {
                    var target_platforms_checkbox = group.find(".edit-resource-target-platforms-enabled");
                    target_platforms_checkbox.prop('checked', true);
                    _.each(_.keys(PLATFORMS), function(platform) {
                        group.find(".edit-resource-target-"+platform).prop('checked', _.contains(value["target_platforms"], platform));
                    });
                }
                group.find(".resource-targets-section input").change(function() {
                    update_platform_labels(pane);
                });

                initialise_resource_id_group(group, resource);

                group.find('.resource-targets-section .text-icon').popover({
                    container: 'body',
                    title: null,
                    trigger: 'hover',
                    html: true,
                    animation: false,
                    delay: {show: 250},
                });

                parent.append(group);
            });
            pane.find('.btn-delidentifier').toggle(resource.resource_ids.length > 1);
            pane.find('#add-resource-id').removeClass('hide').click(function() {
                var clone = parent.find('.resource-id-group-single:last').clone(false);

                if(!clone.length) {
                    clone = template.clone().removeClass('hide').attr('id','');
                }
                parent.append(clone);
                if (resource.kind == 'font') {
                    clone.find('input[type=text], input[type=number]').on('input', function () {
                        update_font_preview(clone);
                    });
                }
                initialise_resource_id_group(clone, resource);
                CloudPebble.Sidebar.SetIcon('resource-'+resource.id, 'edit');
            });

            pane.find('.image-platform-preview').toggle((_.contains(['png', 'png-trans', 'bitmap'], resource.kind)));

            pane.find("#edit-resource-file-name").val(resource.file_name);

            pane.find('#edit-resource-delete').removeClass('hide').click(function() {
                CloudPebble.Prompts.Confirm(interpolate(gettext("Do you want to delete %s?"), [resource.file_name]), gettext("This cannot be undone."), function() {
                    pane.find('input, button, select').attr('disabled', 'disabled');
                    Ajax.Post("/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/delete").then(function() {
                        CloudPebble.Sidebar.DestroyActive();
                        delete project_resources[resource.file_name];
                        list_entry.remove();
                        CloudPebble.Settings.RemoveResource(resource);
                    }).catch(function(error) {
                        alert(error);
                    }).finally(function() {
                        pane.find('input, button, select').removeAttr('disabled');
                        ga('send', 'event', 'resource', 'delete')
                    });
                });
            });

            var form = pane.find('form');

            var live_form = make_live_settings_form({
                form: form,
                save_function: function() {
                    return null;
                },
                on_change: function() {
                    CloudPebble.Sidebar.SetIcon('resource-'+resource.id, 'edit');
                }
            }).init();

            form.submit(save);
            CloudPebble.GlobalShortcuts.SetShortcutHandlers({
                save: save
            });

            restore_pane(pane);
        }).finally(function() {
            CloudPebble.ProgressBar.Hide();
        });
    };


    var restore_pane = function(parent) {
        if (CloudPebble.ProjectInfo.sdk_version == '2') {
            parent.find('.colour-resource, #resource-targets-section').hide();
        } else {
            parent.find('.colour-resource, #resource-targets-section').show();
        }
        if(CloudPebble.ProjectInfo.sdk_version != '3') {
            parent.find('.sdk3-only').hide();
        }
        if(CloudPebble.ProjectInfo.type != 'native') {
            parent.find('.native-only').hide();
        }
    };

    /**
     * Create a tag editor from a textarea
     * @param {jQuery|HTMLElement} pane The pane containing all tag editors
     * @param {jQuery|HTMLElement} textarea The <textarea> element to turn in to a tags editor
     * @param {Array} tags The default set of tags
     */
    var build_tags_editor = function(pane, textarea, tags) {

        var isTagAllowed = function(elm, tag_id) {
            // Check that a new tag doesn't conflict with a tag currently in the specified textex box
            var tags = $(elm).textext()[0].tags()._formData;
            var invalidName = _.isUndefined(_(TAGS).findWhere({id: tag_id}));
            var isExcluded = _.chain(tags).map(function(id) {return get_tag_data_for_id(id).excludes;}).flatten().contains(tag_id).value();
            var existsAlready = _(tags).contains(tag_id);

            return (!(invalidName || isExcluded || existsAlready));
        };

        var allowedTags = function(elm) {
            return _.chain(TAGS)
                .pluck('id')
                .filter(_.partial(isTagAllowed, elm))
                .value();
        };

        var fuse = new Fuse([], {
            threshold: 0.6,
            maxPatternLength: 32
        });

        $(textarea).attr('name', 'variant-'+(tags.join(',') || ''));
        // Set up the resource tag UI
        var textext = textarea.textext_tagger({
            tagsItems : tags,
            ext: {
                itemManager: {
                    // These functions convert between ~tags and Tag Names
                    stringToItem: function(str) {
                        var tag = get_tag_data_for_tag_name(str);
                        if (tag) return tag.id; else return undefined;
                    },
                    itemToString: function(id) {
                        return get_tag_data_for_id(id).name;
                    }
                }
            }
        }).bind('isTagAllowed', function(e, data) {
            // Prevent conflicting tags from being added
            data.result = isTagAllowed(e.target, data.tag);
        }).bind('getSuggestions', function(e, data) {
            // Suggest non-conflicting tags
            var filtered = allowedTags(e.target);
            var suggestions = _.chain(filtered).map(get_tag_data_for_id).pluck('name').value();
            if (data) {
                fuse.set(suggestions);
                filtered = _.map(fuse.search(data.query), function(i) { return filtered[i];});
            }
            $(this).trigger('setSuggestions', {
                result: filtered
            });
        }).bind('change', function() {
            update_platform_labels(pane);
        }).bind('toggled', function() {
            update_platform_labels(pane);
        });
        update_platform_labels(pane);
        return textext.textext()[0];
    };

    var prepare_resource_pane = function() {
        var template = resource_template.clone();
        template.removeClass('hide');
        template.find('.font-only').addClass('hide');
        template.find('.nont-font-only').removeClass('hide');
        template.find('.image-platform-preview').hide();
        template.find('#edit-resource-type').change(function() {
            var kind = $(this).val();
            template.find('.non-font-only').toggleClass('hide', (kind === 'font'));
            template.find('.font-only').toggleClass('hide', (kind !== 'font'));
            template.find('.bitmap-only').toggleClass('hide', (kind !== 'bitmap'));
        });

        template.find("#edit-resource-file").change(function() {
            var input = $(this);
            $('#edit-resource-file-name').val(function(index, old_val) {
                return (old_val || input.val().split(/(\\|\/)/g).pop());
            });
        });

        // setTimeout is used because the textarea has to actually be visible when the textext tag editor is initialised
        setTimeout(function() {
            var textext = build_tags_editor(template, template.find("#new-resource-tags"), []);
            // Disable the new file tag-picker unless a file has been chosen.
            textext.enabled(false);
            template.find("#edit-resource-file").change(function(e) {
                var file_exists = e.target.value.length > 0;
                textext.enabled(file_exists);
                template.find('#edit-resource-new-file').toggleClass('file-present', file_exists);
            });
        }, 1);

        restore_pane(template);
        return template;
    };

    var validate_resource_id = function(id) {
        return REGEXES.c_identifier.test(id);

    };

    var create_new_resource = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('new-resource')) return;
        var pane = prepare_resource_pane();
        var form = pane.find('form');

        form.submit(function(e) {
            e.preventDefault();
            process_resource_form(form, true, null, "/ide/project/" + PROJECT_ID + "/create_resource").then(function(data) {
                CloudPebble.Sidebar.DestroyActive();
                resource_created(data);
            }).catch(function() {/* ignore failure */});
        });

        CloudPebble.Sidebar.SetActivePane(pane, {
            id: 'new-resource',
            onRestore: _.partial(restore_pane, pane)
        });
    };

    var resource_created = function(resource) {
        // Add it to our resource list
        ga('send', 'event', 'resource', 'create');
        add_resource(resource);
        edit_resource(resource);
    };

    var resource_template = null;

    var init = function() {
        // Set up the resource editing template.
        resource_template = $('#resource-pane-template');
        resource_template.remove();
        _.each(_.keys(PLATFORMS), function(platform_name) {
            if (!_.contains(CloudPebble.ProjectInfo.supported_platforms, platform_name)) {
                delete PLATFORMS[platform_name];
            }
        });

        CloudPebble.FuzzyPrompt.AddDataSource('files', function() {
            return project_resources;
        }, function (resource, querystring) {
            edit_resource(resource);
        });
    };

    return {
        Add: function(resource) {
            add_resource(resource);
        },
        Update: function(resource) {
            update_resource(resource);
        },
        Init: function() {
            init();
        },
        Create: function() {
            create_new_resource();
        },
        GetBitmaps: function() {
            return _.filter(project_resources, function(item) { return /^(png|pbi|bitmap)/.test(item.kind); });
        },
        GetFonts: function() {
            return _.where(project_resources, {kind: 'font'});
        },
        GetResourceByID: function(id) {
            return _.find(project_resources, function(resource) { return _.contains(resource.identifiers, id); });
        },
        GetFontFamily: function(font, variant) {
            if(!font.family) {
                font.family = [];
            }
            if (_.isArray(variant)) {
                if (variant.length == 0) {
                    variant = '0';
                }
                else {
                    variant = variant.join(',');
                }
            }
            if(!font.family[variant]) {
                var preview_url = '/ide/project/' + PROJECT_ID + '/resource/' + font.id +'/'+variant+'/get';
                var style = document.createElement('style');
                font.family[variant] = 'font-preview-' + font.id + '-' + (++preview_count);
                var rule = '@font-face { font-family: "' + font.family[variant] + '"; src: url(' + preview_url + '#e' + (preview_count) + '); }';
                style.appendChild(document.createTextNode(rule));
                $('body').append(style);
            }
            return font.family[variant];
        },
        GetDefaultFontFamily: function(font) {
            return CloudPebble.Resources.GetFontFamily(font, '0');
        }
    };
})();
