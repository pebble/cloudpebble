CloudPebble.Resources = (function() {
    var project_resources = {};

    var add_resource = function(resource) {
        var li = CloudPebble.Sidebar.AddResource(resource, function() {
            edit_resource(resource);
        });
        update_resource(resource);
        CloudPebble.Settings.AddResource(resource);
    };

    var update_resource = function(resource) {
        project_resources[resource.file_name] = resource;
        if(resource.kind == 'png-trans' && resource.identifiers.length == 1) {
            var identifier = resource.identifiers[0];
            resource.identifiers = [identifier + '_WHITE', identifier + '_BLACK'];
        }
        CloudPebble.Sidebar.SetPopover('resource-' + resource.id, 'Identifier' + (resource.identifiers.length != 1 ? 's' : ''), resource.identifiers.join('<br>'));
        // We need to reinitialise the editor, which uses this information.
        if(CloudPebble.Editor.Autocomplete.IsInitialised())
            CloudPebble.Editor.Autocomplete.Init();
    };

    var PEBBLE_PPI = 175.2;

    var process_resource_form = function(form, is_new, url, callback) {
        var report_error = function(message) {
            form.find('.alert:first').removeClass("hide").text(message);
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
                form.find('input, button').removeAttr('disabled');
            }
        };

        remove_error();
        var files = form.find('#edit-resource-file').get(0).files;
        var file = (files.length > 0) ? files[0] : null;
        if(is_new) {
            if(files.length != 1) {
                report_error("You must upload a file.");
                return;
            }
            if(!!project_resources[file.name]) {
                report_error("A resource called '" + file.name + "' already exists in the project.");
                return;
            }
        }
        var kind = form.find('#edit-resource-type').val();
        if(files.length == 1) {
            if((kind == 'png' || kind == 'png-trans') && file.type != "image/png") {
                report_error("You must upload a PNG image.");
                return;
            }
            if(kind == 'font' && !/\.ttf$/i.test(file.name)) {
                report_error("You must upload a TrueType Font (.ttf)");
                return;
            }
        }
        var resources = [];
        if(kind != 'font') {
            var resource_id = form.find('#non-font-resource-group .edit-resource-id').val();
            if(resource_id === '' || !validate_resource_id(resource_id)) {
                report_error("You must provide a valid resource identifier. Use only letters, numbers and underscores.");
                return;
            }
            resources = [{'id': resource_id}];
        } else {
            var resource_ids = {};
            var okay = true;
            $.each(form.find('.font-resource-group-single'), function(index, value) {
                value = $(value);
                var resource_id = value.find('.edit-resource-id').val();
                var regex = value.find('.edit-resource-regex').val();
                var tracking = parseInt(value.find('.edit-resource-tracking').val() || '0', 10);
                if(resource_id === '') return true; // continue
                if(!validate_resource_id(resource_id)) {
                    report_error("Invalid resource identifier. Use only letters, numbers and underscores.");
                    okay = false;
                    return false;
                }
                if(!/[0-9]+$/.test(resource_id)) {
                    report_error("Font resource identifiers must end with the desired font size, e.g. " + resource_id + "_24");
                    okay = false;
                    return false;
                }
                if(!!resource_ids[resource_id]) {
                    report_error("You can't have multiple identical identifiers. Please remove or change one.");
                    okay = false;
                    return false;
                }
                if(tracking != tracking) {
                    report_error("Tracking must be an integer.");
                    okay = false;
                    return false;
                }
                resource_ids[resource_id] = true;
                resources.push({'id': resource_id, 'regex': regex, 'tracking': tracking});
            });
            if(!okay) return;
            if(resources.length === 0) {
                report_error("You must specify at least one resource.");
                return;
            }
        }
        var form_data = new FormData();
        form_data.append("kind", kind);
        form_data.append("file", file);
        form_data.append("resource_ids", JSON.stringify(resources));
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

    var edit_resource = function(resource) {
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
            var preview_img = null;
            var preview_count = 0;
            if(list_entry) {
                list_entry.addClass('active');
            }

            CloudPebble.Sidebar.SetActivePane(pane, 'resource-' + resource.id);
            pane.find('#edit-resource-type').val(resource.kind).attr('disabled', 'disabled');
            pane.find('label[for="edit-resource-file"]').text("Replace with new file");
            pane.find('#edit-resource-file').after($("<span class='help-block'>If specified, this file will replace the current file for this resource, regardless of its filename.</span>"));

            // Generate a preview.
            var preview_url = '/ide/project/' + PROJECT_ID + '/resource/' + resource.id +'/get';
            if(resource.kind == 'png' || resource.kind == 'png-trans') {
                var div = $('<div class="span4 text-center">');
                preview_img = $('<img class="img-polaroid img-dimmer">');
                preview_img.attr('src', preview_url);
                div.append(preview_img);
                var dimensions = $('<p class="muted">');
                // Create an unscaled image and make sure it's in the DOM so we can see its size.
                preview_img.load(function() {
                    dimensions.text(this.naturalWidth + ' x ' + this.naturalHeight);
                });
                div.append(dimensions);
                $('.resource-type-column').removeClass('span12').addClass('span8').before(div);
            } else if(resource.kind == 'font') {
                var style = document.createElement('style');
                ++preview_count;
                var rule = '@font-face { font-family: "font-preview-' + resource.id + '-' + (preview_count) + '"; src: url(' + preview_url + '#e' + (preview_count) + '); }';
                style.appendChild(document.createTextNode(rule));
                $('body').append(style);
            }
            pane.find('.resource-download-link').removeClass('hide').find('a').attr('href', preview_url);

            var update_font_preview = function(group) {
                group.find('.font-preview').remove();
                var regex_str = group.find('.edit-resource-regex').val();
                var id_str = group.find('.edit-resource-id').val();
                var preview_regex = new RegExp('');
                try {
                    preview_regex = new RegExp(regex_str ? regex_str : '.', 'g');
                    group.find('.font-resource-regex-group').removeClass('error').find('.help-block').text("A PCRE regular expression that restricts characters.");
                } catch(e) {
                    group.find('.font-resource-regex-group').addClass('error').find('.help-block').text(e);
                }
                var tracking = parseInt(group.find('.edit-resource-tracking').val(), 10) || 0;
                var row = $('<div class="control-group font-preview"><label class="control-label">Preview</label>');
                var preview = $('<div class="controls">');
                var line1 = ('abcdefghijklmnopqrstuvwxyz'.match(preview_regex)||[]).join('');
                var line2 = ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.match(preview_regex)||[]).join('');
                var line3 = ('0123456789'.match(preview_regex) || []).join('');
                var line4 = ('~!@#$%^& *()_+[]{}\\|;:\'"<>?`'.match(preview_regex)||[]).join('');
                var font_size = id_str.match(/[0-9]+$/)[0];
                preview.html(line1 + (line1 ? "<br>" : '') + line2 + (line2 ? "<br>" : '')+ line3 + (line3 ? "<br>" : '')+ line4);
                // Officially, a CSS pixel is defined as one pixel at 96 dpi.
                // 96 / PEBBLE_PPI should thus be correct.
                // We use 'transform' to work around https://bugs.webkit.org/show_bug.cgi?id=20606
                preview.css({
                    'font-family': 'font-preview-' + resource.id + '-' + preview_count,
                    'font-size': font_size + 'px',
                    'line-height': font_size + 'px',
                    'letter-spacing': tracking + 'px',
                    'transform': 'scale(' + (96 / PEBBLE_PPI) + ')',
                    'transform-origin': '0 0'
                });
                row.append(preview);
                group.append(row);
            };


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

            pane.find('#edit-resource-delete').removeClass('hide').click(function() {
                CloudPebble.Prompts.Confirm("Do you want to delete " + resource.file_name + "?", "This cannot be undone.", function() {
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
            form.submit(function(e) {
                e.preventDefault();
                process_resource_form(form, false, "/ide/project/" + PROJECT_ID + "/resource/" + resource.id + "/update", function(data) {
                    // Update any previews we have.
                    if(preview_img) {
                        preview_img.attr('src', preview_img.attr('src').replace(/#e.*$/,'') + '#e' + (++preview_count));
                    }
                    if(resource.kind == 'font') {
                        var style = document.createElement('style');
                        ++preview_count;
                        var rule = '@font-face { font-family: "font-preview-' + resource.id + '-' + (preview_count) + '"; src: url(' + preview_url + '#e' + (preview_count) + '); }';
                        style.appendChild(document.createTextNode(rule));
                        $('body').append(style);
                        $.each(pane.find('.font-resource-group-single'), function(index, group) {
                            update_font_preview($(group));
                        });
                    }
                    // Update our information about the resource.
                    update_resource(data);
                });
            });

        });
    };

    var prepare_resource_pane = function() {
        var template = resource_template.clone();
        template.removeClass('hide');

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
        return template;
    };

    var validate_resource_id = function(id) {
        if(/[^a-zA-Z0-9_]/.test(id)) {
            return false;
        }
        return true;
    };

    var create_new_resource = function() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore('new-resource')) return;
        var pane = prepare_resource_pane();
        var form = pane.find('form');

        form.submit(function(e) {
            e.preventDefault();
            process_resource_form(form, true, "/ide/project/" + PROJECT_ID + "/create_resource", function(data) {
                CloudPebble.Sidebar.DestroyActive();
                resource_created(data);
            });
        });

        CloudPebble.Sidebar.SetActivePane(pane, 'new-resource');
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
            names = [];
            $.each(project_resources, function(index, value) {
                $.each(value.identifiers, function(index, id) {
                    names.push("RESOURCE_ID_" + id);
                });
            });
            return names;
        }
    };
})();
