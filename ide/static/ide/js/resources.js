CloudPebble.Resources = (function() {
    var POSSIBLE_PLATFORMS = ["aplite", "basalt", "chalk"];
    var project_resources = {};
    var preview_count = 0;

    var TAG_MONOCHROME = 1;
    var TAG_COLOUR = 2;
    var TAG_RECT = 3;
    var TAG_ROUND = 4;
    var TAG_APLITE = 5;
    var TAG_BASALT = 6;
    var TAG_CHALK = 7;

    var TAGS = {
        color: {name: gettext("Colour"), id: TAG_COLOUR, excludes: [TAG_MONOCHROME, TAG_APLITE]},
        bw: {name: gettext("Monochrome"), id:TAG_MONOCHROME,  excludes: [TAG_COLOUR, TAG_BASALT, TAG_CHALK, TAG_ROUND]},
        aplite: {name: "Aplite", id: TAG_APLITE, excludes: [TAG_BASALT, TAG_CHALK, TAG_ROUND, TAG_COLOUR]},
        basalt: {name: "Basalt", id: TAG_BASALT, excludes: [TAG_APLITE, TAG_CHALK, TAG_ROUND, TAG_MONOCHROME]},
        chalk: {name: "Chalk", id: TAG_CHALK, excludes: [TAG_APLITE, TAG_BASALT, TAG_MONOCHROME, TAG_RECT]},
        round: {name: gettext("Round"), id: TAG_ROUND, excludes: [TAG_RECT, TAG_MONOCHROME, TAG_APLITE, TAG_BASALT]},
        rect: {name: gettext("Rectangular"), id: TAG_RECT, excludes: [TAG_ROUND, TAG_CHALK]}
    };

    var PLATFORM_TAGS = {
        aplite: [TAG_APLITE, TAG_MONOCHROME, TAG_RECT],
        basalt: [TAG_BASALT, TAG_COLOUR, TAG_RECT],
        chalk: [TAG_CHALK, TAG_COLOUR, TAG_ROUND]
    };

    function get_tag_data_for_tag_name(name) {
        return _.findWhere(TAGS, {name: name});
    }

    function get_tag_data_for_id(id) {
        return _.findWhere(TAGS, {id: id});
    }

    function get_target_platforms(pane) {
        pane = $(pane);
        var do_target_platforms = pane.find('#edit-resource-target-platforms-enabled').is(":checked");
        return (!do_target_platforms ? null : _.filter(POSSIBLE_PLATFORMS, function(platform) {
            return pane.find('#edit-resource-target-'+platform).is(":checked");
        }));
    }

    function get_image_preview_for_tag_input(tags) {
        // Given a set of tags currently typed in one of the boxes,
        // which image preview element does it belong to?
        return $('.text-wrap input').filter(function() {
            return ((_.isEqual(JSON.parse($(this).val()), tags)) && $(this).siblings('textarea').is(':enabled'));
        }).parents('.well');
    }

    function get_new_tag_values(parent, should_include_new_file_tags, do_sort) {
        return $.makeArray($(parent).find('.text-wrap input').filter(function() {
            // Only check the uploading-file tags if we're uploading a file
            var is_new_file_well = $(this).closest('#edit-resource-new-file').length;
            return (!is_new_file_well || should_include_new_file_tags);
        }).map(function(i, input) {
            // Just extract the tag numbers.
            var tags = JSON.parse(input.value);
            if (do_sort) tags.sort();
            return [tags];
        }));
    }


    var update_platform_labels = _.throttle(function(pane) {
        pane = $(pane);
        var include_uploader = pane.find('#edit-resource-new-file textarea').is(':enabled');
        var new_tag_values = get_new_tag_values(document, include_uploader, false);
        pane.find('.label-list').empty();
        var target_platforms = get_target_platforms(pane);
        var targeted_platform_tags = (target_platforms!== null ? _.pick(PLATFORM_TAGS, target_platforms) : PLATFORM_TAGS);
        pane.find(".image-platform-preview img").hide();
        pane.find(".image-platform-preview span").text('Not targeted').removeClass('conflict');

        _.each(targeted_platform_tags, function(platform_tags, platform_name) {
            var per_platform_preview_pane = pane.find("#resource-image-preview-for-"+platform_name);
            try {
                // Update the label tag
                var tags_for_this_platform = get_resource_for_platform(new_tag_values, platform_tags, platform_name);
                var preview_pane = get_image_preview_for_tag_input(tags_for_this_platform);
                var list = preview_pane.find('.label-list');
                $("<span>").text(platform_name).addClass('label').attr('title', null).addClass('label-'+platform_name).appendTo(list);
                // Then the preview images
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
                if (err.conflicts) {
                    per_platform_preview_pane.find('img').hide();
                    per_platform_preview_pane.find('span').text("Conflict!").addClass('conflict');
                    _.each(err.conflicts, function(tags) {
                        var list = get_image_preview_for_tag_input(tags).find('.label-list').empty();
                        $("<span>").text(gettext("conflict")).attr('title', err.description).addClass('label').addClass('label-error').appendTo(list);
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
        CloudPebble.Sidebar.SetPopover('resource-' + resource.id, ngettext('Identifier', 'Identifiers', resource.identifiers.length), resource.identifiers.join('<br>'));
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
        if((kind == 'png' || kind == 'png-trans') && file.type != "image/png") {
            throw (gettext("You must upload a PNG image."));
        }
        return file;
    }

    // For a given platform, find out which platform
    function get_resource_for_platform(tag_values, platform_tags, platform_name) {
        // TODO: This will eventually need to be updated to support setting targetPlatforms for each resource ID.
        // Find all variants with tags which fully apply to this platform.
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
            throw {
                description: interpolate(gettext("Conflict for platform '%s'. The variants with tags %s have the same specicifity."), [platform_name, conflict_string]),
                conflicts: conflicts
            };
        }
        // There may be no resource for this platform
        if (conflicts.length == 0) {
            return null;
        }
        // Otherwise, return the variant for this platform
        return conflicts[0];
    }

    var process_resource_form = function(form, is_new, current_filename, url, callback) {
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
            if(is_new) {
                form.find('input, button, select').removeAttr('disabled');
            } else {
                form.find('input, button, .font-compat-option').removeAttr('disabled');
            }
        };

        remove_error();
        var kind = form.find('#edit-resource-type').val();
        var name = form.find("#edit-resource-file-name").val();
        var file;

        // Process the file to be uploaded
        try {
            file = process_file(kind, form.find('#edit-resource-file'));
        }
        catch (e) {
            report_error(e);
            return;
        }

        // Check that the user uploaded a new file for a new resource
        if(is_new && !file) {
            report_error("You must upload a resource.");
        }

        // Check for file name conflicts
        if (_.has(project_resources, name) && name !== current_filename) {
            report_error(interpolate(gettext("A resource called '%s' already exists in the project."), [name]));
            return;
        }

        // Validate the file name

        if (!/^[a-zA-Z0-9_(). -]+$/.test(name)) {
            report_error(gettext("You must provide a valid filename. Only alphanumerics and characters in the set \"_(). -\" are allowed."));
            return;
        }
        var resources = [];
        if(kind != 'font') {
            // Check that the Resource ID is valid
            if(CloudPebble.ProjectInfo.type != 'pebblejs') {
                var resource_id = form.find('#non-font-resource-group .edit-resource-id').val();
                if(resource_id === '' || !validate_resource_id(resource_id)) {
                    report_error(gettext("You must provide a valid resource identifier. Use only letters, numbers and underscores."));
                    return;
                }
                resources = [{'id': resource_id}];
            }
        } else {
            var resource_ids = {};
            var okay = true;
            $.each(form.find('.font-resource-group-single'), function(index, value) {
                value = $(value);
                var resource_id = value.find('.edit-resource-id').val();
                var regex = value.find('.edit-resource-regex').val();
                var tracking = parseInt(value.find('.edit-resource-tracking').val() || '0', 10);
                var compat = value.find('.font-compat-option').val() || null;
                if(resource_id === '') return true; // continue
                if(!validate_resource_id(resource_id)) {
                    report_error(gettext("Invalid resource identifier. Use only letters, numbers and underscores."));
                    okay = false;
                    return false;
                }
                if(!/[0-9]+$/.test(resource_id)) {
                    report_error(interpolate(gettext("Font resource identifiers must end with the desired font size, e.g. %s_24"), [resource_id]));
                    okay = false;
                    return false;
                }
                if(!!resource_ids[resource_id]) {
                    report_error(gettext("You can't have multiple identical identifiers. Please remove or change one."));
                    okay = false;
                    return false;
                }
                if(tracking != tracking) {
                    report_error(gettext("Tracking must be an integer."));
                    okay = false;
                    return false;
                }
                resource_ids[resource_id] = true;
                resources.push({'id': resource_id, 'regex': regex, 'tracking': tracking, 'compatibility': compat});
            });
            if(!okay) return;
            if(resources.length === 0) {
                report_error(gettext("You must specify at least one resource."));
                return;
            }
        }

        // Extract target platforms and verify that they're valid
        var target_platforms = get_target_platforms(form);
        var targeted_platform_tags = (target_platforms!== null ? _.pick(PLATFORM_TAGS, target_platforms) : PLATFORM_TAGS);
        if (_.isEqual(target_platforms, [])) {
            report_error(gettext("You cannot specifically target no platforms."));
            return;
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

        // Validate the tags: ensure that all variants are unique
        if (_.uniq(_.map(new_tag_values, JSON.stringify)).length != new_tag_values.length) {
            report_error("Each variant must have a different set of tags");
            return;
        }


        // Validate the tags: detect ambiguities and check that each targeted platform has a matching variant
        for (var platform_name in targeted_platform_tags) {
            try {
                if (get_resource_for_platform(new_tag_values, targeted_platform_tags[platform_name], platform_name) == null) {
                    report_error(interpolate(gettext("There is no variant matching the target platform '%s'."), [platform_name]));
                    return false;
                }
            }
            catch (err) {
                report_error(err.description || err);
                return false;
            }
        }

        var variant_tags = extract_tags(form.find('#edit-resource-previews .text-wrap input'));
        var new_tags = extract_tags(form.find('#edit-resource-new-file .text-wrap input'));

        var form_data = new FormData();
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


        form_data.append("target_platforms", JSON.stringify(target_platforms));

        disable_controls();
        $.ajax({
            url: url,
            type: "POST",
            data: form_data,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: function(data) {
                enable_controls();
                if(data.success) {
                    callback(data.file);
                } else {
                    report_error(data.error);
                }
            }
        });
        ga('send', 'event', 'resource', 'save');
    };

    var show_resource_targets = function(parent) {
        var target_platforms_checkbox = parent.find("#edit-resource-target-platforms-enabled");
        parent.find('#edit-resource-targets').toggle(target_platforms_checkbox.is(":checked"));
    };

    var edit_resource = function(resource) {
        CloudPebble.FuzzyPrompt.SetCurrentItemName(resource.file_name);
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('resource-' + resource.id)) return;
        ga('send', 'event', 'resource', 'open');

        CloudPebble.ProgressBar.Show();
        $.getJSON("/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/info", function(data) {
            CloudPebble.ProgressBar.Hide();
            if(!data.success) return;
            var resource = data.resource;
            var pane = prepare_resource_pane();

            var list_entry = $('#sidebar-pane-resource-' + resource.id);
            var target_platforms_checkbox = pane.find("#edit-resource-target-platforms-enabled");
            if(list_entry) {
                list_entry.addClass('active');
            }

            CloudPebble.Sidebar.SetActivePane(pane, 'resource-' + resource.id, _.partial(restore_pane, pane));
            pane.find('#edit-resource-type').val(resource.kind).attr('disabled', 'disabled');
            pane.find('#edit-resource-type').change();

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
                        case 'png':
                        case 'png-trans':
                            template_name = 'image';
                            break;
                        case 'raw':
                        case 'pbi':
                        case 'font':
                            template_name = 'raw';
                            break;
                    }

                    var preview_url = '/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/' + variant_string + '/get';
                    var preview_pane = pane.find('#edit-'+template_name+'-resource-preview-template > div').clone();
                    preview_pane.appendTo(previews).hide();

                    if (template_name == 'image') {
                        var preview_img = preview_pane.find('.image-resource-preview img');
                        preview_img.attr('src', preview_url);
                        var dimensions = preview_pane.find('.image-resource-preview-dimensions');
                        preview_img.load(function () {
                            dimensions.text(this.naturalWidth + ' x ' + this.naturalHeight);
                            preview_pane.show();
                            build_tags_editor(pane, preview_pane.find('.resource-tags'), tags) ;
                        });
                    }
                    if (template_name == 'raw') {
                        preview_pane.find('.resource-download-link').removeClass('hide').find('a').attr('href', preview_url);
                        preview_pane.show();
                        build_tags_editor(pane, preview_pane.find('.resource-tags'), tags) ;
                    }

                    preview_pane.find('.btn-delvariant').click(function() {
                        CloudPebble.Prompts.Confirm(gettext("Do you want to this resource variant?"), gettext("This cannot be undone."), function () {
                            pane.find('input, button, select').attr('disabled', true);

                            $.post('/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/' + variant_string + '/delete', function (data) {
                                pane.find('input, button, select').removeAttr('disabled');
                                if (data.success) {
                                    // Regenerate all the previews from scratch.
                                    // It's the easiest way.
                                    resource.variants = data.resource.variants;
                                    project_resources[resource.file_name].variants = resource.variants;
                                    generate_resource_previews(resource.kind);
                                } else {
                                    alert(data.error);
                                }
                                ga('send', 'event', 'resource', 'delete')
                            });
                        });
                    });
                });

                // Only show the delete-variant buttons if there's more than one variant
                pane.find('.btn-delvariant').toggle(resource.variants.length > 1);
            };

            if (true || resource.kind == 'png' || resource.kind == 'png-trans') {
                generate_resource_previews(resource.kind);
            } else {
                var preview_url = '/ide/project/' + PROJECT_ID + '/resource/' + resource.id + '/0/get';
                pane.find('.resource-download-link').removeClass('hide').find('a').attr('href', preview_url);
            }

            var update_font_preview = function(group) {
                group.find('.font-preview').remove();
                var regex_str = group.find('.edit-resource-regex').val();
                var id_str = group.find('.edit-resource-id').val();
                var preview_regex = new RegExp('');
                try {
                    preview_regex = new RegExp(regex_str ? regex_str : '.', 'g');
                    group.find('.font-resource-regex-group').removeClass('error').find('.help-block').text(gettext("A PCRE regular expression that restricts characters."));
                } catch(e) {
                    group.find('.font-resource-regex-group').addClass('error').find('.help-block').text(e);
                }
                var tracking = parseInt(group.find('.edit-resource-tracking').val(), 10) || 0;

                _.each(resource.variants, function(tags) {
                    var row = $('<div class="control-group font-preview"><label class="control-label">' + gettext('Preview') + '</label>');
                    var preview_holder = $('<div class="controls">');
                    $('<div class="font-tag-preview">').appendTo(preview_holder).text(_.chain(tags).map(get_tag_data_for_id).pluck('name').value().join(', ') || gettext("No tags"));
                    var preview = $('<div>').appendTo(preview_holder);
                    var line = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@#$%^& *()_+[]{}\\|;:\'"<>?`'.match(preview_regex)||[]).join('');
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
                        'color': 'black'
                    });
                    row.append(preview_holder);
                    group.append(row);
                });
            };
            var has_target_platforms = _.isArray(resource["target_platforms"]);
            if (has_target_platforms) {
                target_platforms_checkbox.prop('checked', true);
                _.each(POSSIBLE_PLATFORMS, function(platform) {
                    $("#edit-resource-target-"+platform).prop('checked', _.contains(resource["target_platforms"], platform));
                });
            }
            show_resource_targets(pane);
            if(resource.kind != 'font') {
                if(resource.resource_ids.length > 0) {
                    pane.find('#non-font-resource-group .edit-resource-id').val(resource.resource_ids[0].id);
                }
            } else {
                pane.find('#non-font-resource-group').addClass('hide');
                var template = pane.find('.font-resource-group-single').detach();
                var parent = $('#font-resource-group').removeClass('hide');
                $.each(resource.resource_ids, function(index, value) {
                    var group = template.clone();
                    group.removeClass('hide').attr('id','');
                    group.find('.edit-resource-id').val(value.id);
                    group.find('.edit-resource-regex').val(value.regex);
                    group.find('.edit-resource-tracking').val(value.tracking || '0');
                    group.find('.font-compat-option').val(value.compatibility || "");
                    update_font_preview(group);
                    group.find('input[type=text], input[type=number]').on('input', function() {
                        update_font_preview(group);
                    });
                    parent.append(group);
                });
                pane.find('#add-font-resource').removeClass('hide').click(function() {
                    var clone = parent.find('.font-resource-group-single:last').clone(false);
                    if(!clone.length) {
                        clone = template.clone().removeClass('hide').attr('id','');
                    }
                    parent.append(clone);

                    clone.find('input[type=text], input[type=number]').on('input', function() {
                        update_font_preview(clone);
                    });
                });
            }

            console.log(resource.kind);
            pane.find('.image-platform-preview').toggle((resource.kind == 'png' || resource.kind == 'png-trans'));

            pane.find("#edit-resource-file-name").val(resource.file_name);

            pane.find('#edit-resource-delete').removeClass('hide').click(function() {
                CloudPebble.Prompts.Confirm(interpolate(gettext("Do you want to delete %s?"), [resource.file_name]), gettext("This cannot be undone."), function() {
                    pane.find('input, button, select').attr('disabled', 'disabled');
                    $.post("/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/delete", function(data) {
                        pane.find('input, button, select').removeAttr('disabled');
                        if(data.success) {
                            CloudPebble.Sidebar.DestroyActive();
                            delete project_resources[resource.file_name];
                            list_entry.remove();
                            CloudPebble.Settings.RemoveResource(resource);
                        } else {
                            alert(data.error);
                        }
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
                on_change_function: function() {
                    CloudPebble.Sidebar.SetIcon('resource-'+resource.id, 'edit');
                }
            }).init();
            form.submit(function(e) {
                e.preventDefault();
                process_resource_form(form, false, resource.file_name, "/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/update", function(data) {
                    delete project_resources[resource.file_name];
                    // Update our information about the resource.
                    update_resource(data);
                    resource = project_resources[data.file_name];

                    // Set the resource's sidebar name
                    generate_resource_previews(resource.kind);
                    CloudPebble.Sidebar.SetItemName('resource', data.id, data.file_name);

                    if(resource.kind == 'font') {
                        resource.family = null;
                        $.each(pane.find('.font-resource-group-single'), function(index, group) {
                            update_font_preview($(group));
                        });
                    }

                    // Clear and disable the upload-file form
                    pane.find('#edit-resource-new-file input').val('');
                    pane.find('#edit-resource-new-file textarea').textext()[0].tags().empty().core().enabled(false);
                    CloudPebble.Sidebar.ClearIcon('resource-'+resource.id);
                    live_form.clearIcons();
                });
            });

            restore_pane(pane);
        });
    };


    var restore_pane = function(parent) {
        if (CloudPebble.ProjectInfo.sdk_version == '2') {
            parent.find('.colour-resource, #resource-targets-section').hide();
        } else {
            parent.find('.colour-resource, #resource-targets-section').show();
            show_resource_targets(parent)
        }
        if(CloudPebble.ProjectInfo.sdk_version != '3') {
            parent.find('.sdk3-only').hide();
            parent.find('#edit-resource-new-file').hide();
        }
        if(CloudPebble.ProjectInfo.type != 'native') {
            console.log("hiding native only");
            parent.find('.native-only').hide();
            parent.find('#edit-resource-new-file').hide();
        }
    };

    var build_tags_editor = function(pane, textarea, tags) {
        // Create the tags editor.

        // The textext library does strange things with with sizing. This seems to fix it.
        $(textarea).height($(textarea).height()).attr('name', 'variant-'+(tags.join(',') || ''));
        var fuse = new Fuse([], {
            threshold: 0.6,
            maxPatternLength: 32
        });

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
        var initialised = false;

        // Set up the resource tag UI
        var textext = textarea.textext({
            plugins : 'tags prompt focus autocomplete arrow',
            tagsItems : tags,//_(tags || []).map(get_tag_for_id),
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
                                this.wrapElement().find('textarea').attr('disabled', false);
                            }
                            else {
                                this.wrapElement().addClass('disabled');
                                this.wrapElement().find('textarea').attr('disabled', true);
                            }
                            update_platform_labels(pane);
                            return this;
                        }

                    }
                },
                itemManager: {
                    // These functions convert between ~tags and Tag Names
                    stringToItem: function(str) {
                        var tag = get_tag_data_for_tag_name(str);
                        if (tag) return tag.id; else return undefined;
                    },
                    itemToString: function(id) {
                        return get_tag_data_for_id(id).name;
                    }
                },
                arrow: {
                    onArrowClick: function(e) {
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
        });
        update_platform_labels(pane);
        return textext.textext()[0];
    };

    var prepare_resource_pane = function() {
        var template = resource_template.clone();
        template.removeClass('hide');

        template.find('.image-platform-preview').hide();
        template.find('#edit-resource-type').change(function() {
            if($(this).val() == 'font') {
                template.find('#non-font-resource-group').addClass('hide');
                template.find('#font-resource-group').removeClass('hide');
                template.find('#add-font-resource').removeClass('hide');
            } else {
                template.find('#font-resource-group').addClass('hide');
                template.find('#non-font-resource-group').removeClass('hide');
                template.find('#add-font-resource').addClass('hide');
            }
        });

        template.find("input[type=file]").change(function() {
            var input = $(this);
            $('#edit-resource-file-name').val(function(index, old_val) {
                return (old_val || input.val().split(/(\\|\/)/g).pop());
            });
        });

        template.find("#edit-resource-target-platforms-enabled").change(_.partial(show_resource_targets, template));
        template.find("#resource-targets-section input").change(function() {update_platform_labels(template);});

        // setTimeout is used because the textarea has to actually be visible when the textext tag editor is initialised
        setTimeout(function() {
            var textext = build_tags_editor(template, template.find("#new-resource-tags"), []);
            // Disable the new file tag-picker unless a file has been chosen.
            textext.enabled(false);
            template.find("input[type='file']").change(function(e) {
                textext.enabled(e.target.value.length > 0);
            });
        }, 1);

        restore_pane(template);
        return template;
    };

    var validate_resource_id = function(id) {
        return !/[^a-zA-Z0-9_]/.test(id);

    };

    var create_new_resource = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('new-resource')) return;
        var pane = prepare_resource_pane();
        var form = pane.find('form');

        form.submit(function(e) {
            e.preventDefault();
            process_resource_form(form, true, null, "/ide/project/" + PROJECT_ID + "/create_resource", function(data) {
                CloudPebble.Sidebar.DestroyActive();
                resource_created(data);
            });
        });

        CloudPebble.Sidebar.SetActivePane(pane, 'new-resource', _.partial(restore_pane, pane));
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
        GetResourceIDs: function() {
            var names = [];
            $.each(project_resources, function(index, value) {
                $.each(value.identifiers, function(index, id) {
                    names.push("RESOURCE_ID_" + id);
                });
            });
            return names;
        },
        GetBitmaps: function() {
            return _.filter(project_resources, function(item) { return /^png/.test(item.kind); });
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
