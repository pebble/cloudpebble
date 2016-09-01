CloudPebble.Sidebar = (function() {
    var suspended_panes = {};

    var suspend_active_pane = function() {
        var pane_id = $('#main-pane').data('pane-id');
        if (!pane_id) {
            destroy_active_pane();
            $('#pane-parent').append($('<div id="main-pane"></div>'));
            return;
        }
        var pane = $('#main-pane');

        var suspend_function = pane.data('pane-suspend-function');
        if (suspend_function) suspend_function();

        var list_entry = $('#sidebar-pane-' + pane_id);
        if (list_entry) {
            list_entry.removeClass('active');
        }
        suspended_panes[pane_id] = pane;
        pane.detach();
        // Create a new empty one.
        var empty_pane = $('<div id="main-pane"></div>');
        $('#pane-parent').append(empty_pane);
    };

    var destroy_active_pane = function() {
        var pane_id = $('#main-pane').data('pane-id');
        var pane = $('#main-pane');
        if (pane.data('pane-destroy-function')) {
            pane.data('pane-destroy-function')(pane);
        }
        pane.remove();
        var list_entry = $('#sidebar-pane-' + pane_id);
        if (list_entry) {
            list_entry.removeClass('active');
        }
    };

    var restore_suspended_pane = function(id) {
        var pane = suspended_panes[id];
        if (pane) {
            $('#main-pane').remove();
            $('#pane-parent').append(pane);
            delete suspended_panes[id];

            var list_entry = $('#sidebar-pane-' + id);
            if (list_entry) {
                list_entry.addClass('active');
            }

            if (pane.data('pane-restore-function')) {
                pane.data('pane-restore-function')();
            }

            return true;
        }
        return false;
    };

    var set_main_pane = function(pane, options) {
        $('#main-pane').append(pane).data('pane-id', options.id);
        if (options.onRestore) {
            $('#main-pane').data('pane-restore-function', options.onRestore);
        }
        if (options.onDestroy) {
            $('#main-pane').data('pane-destroy-function', options.onDestroy);
        }
        if (options.onSuspend) {
            $('#main-pane').data('pane-suspend-function', options.onSuspend);
        }
    };

    var set_active_menu_entry = function(id) {
        $('#sidebar-pane-' + id).addClass('active');
    };
    
    var get_source_section = function(kind) {
        var id = 'sidebar-sources-' + kind;
        var container = $('#sidebar-sources');
        var section = container.find('#' + id);
        if (!section.length) {
            var header = $('<span class="nav-header">').text(CloudPebble.TargetNames[kind]);
            section = $('<ul class="nav-list">').attr('id', id);
            container.append($('<li>').append([header, section]));
            var add_button = container.find('#new-source-file');
            if (!add_button.length) {
                header.after($('<button class="btn btn-small" id="new-source-file">').click(CloudPebble.Editor.Create).text(gettext('Add new'))).after(" ");
            }
        }
        return section;
    };

    function render_file_link(id, name, on_click) {
        var link = $('<a href="#">').text(name + ' ').click(on_click);
        return $('<li>')
            .attr('id', id)
            .append(link);
    }

    function create_initial_sections(type) {
        var default_sections_for_project_types = {
            native: ['app', 'pkjs'],
            pebblejs: ['app'],
            simplyjs: ['app'],
            'package': ['app', 'pkjs', 'public'],
            rocky: ['app', 'pkjs', 'common']

        };
        _.each(default_sections_for_project_types[type], get_source_section)
    }

    return {
        SuspendActive: function() {
            suspend_active_pane();
        },
        DestroyActive: function() {
            destroy_active_pane();
        },
        Restore: function(id) {
            var restored = restore_suspended_pane(id);
            if (restored) {
                set_active_menu_entry(id);
            }
            return restored;
        },
        SetActivePane: function(pane, options) {
            var opts = options || {};
            suspend_active_pane();
            set_main_pane(pane, opts);
            set_active_menu_entry(opts.id);
        },
        AddResource: function(resource, on_click) {
            var section = $('#sidebar-resources');
            return render_file_link('sidebar-pane-resource-' + resource.id, resource.file_name, on_click).appendTo(section);
        },
        SetItemName: function(kind, id, new_name) {
            // We need to keep any icons
            var link = $('#sidebar-pane-' + kind + '-' + id + ' a');
            var icons = link.children();
            icons.detach();
            link.text(new_name + ' ').append(icons);
        },
        AddSourceFile: function(file, on_click) {
            var section = get_source_section(file.target);
            return render_file_link("sidebar-pane-source-" + file.id, file.name, on_click).appendTo(section);
        },
        Remove: function(id) {
            $('#sidebar-pane-' + id).remove();
        },
        SetIcon: function(pane_id, icon) {
            var a = $('#sidebar-pane-' + pane_id).find('a');
            var i = a.find('i');
            if (i.length === 0) {
                i = $('<i>');
                a.append(i);
            }

            a.find('i').removeClass().addClass('icon-' + icon);
        },
        ClearIcon: function(pane_id) {
            $('#sidebar-pane-' + pane_id).find('a > i').remove();
        },
        Init: function() {
            $('#sidebar-pane-new-resource').click(CloudPebble.Resources.Create);
            $('#sidebar-pane-compile > a').click(CloudPebble.Compile.Show);
            $('#sidebar-pane-dependencies > a').click(CloudPebble.Dependencies.Show);
            $('#sidebar-pane-settings > a').click(CloudPebble.Settings.Show);
            $('#sidebar-pane-github > a').click(CloudPebble.GitHub.Show);
            $('#sidebar-pane-timeline > a').click(CloudPebble.Timeline.show);
            create_initial_sections(CloudPebble.ProjectInfo.type);
        },
        SetPopover: function(pane_id, title, content) {
            $('#sidebar-pane-' + pane_id).find('a').popover('destroy').popover({
                trigger: 'hover',
                title: title,
                content: content,
                html: true,
                animation: false,
                delay: {show: 250},
                container: 'body'
            }).click(function() {
                $(this).popover('hide');
            });
        },
        SetProjectType: function(type) {
            if (type != 'native') {
                $('.native-only').hide();
            }
            if (type != 'package') {
                $('.package-only').hide();
            }
            if (type == 'simplyjs') {
                $('.not-simplyjs').hide();
            }
            if (type == 'pebblejs') {
                $('.not-pebblejs').hide();
            }
            if(type == 'rocky') {
                $('.not-rocky').hide();
            }
            else {
                $('.rocky-only').hide();
            }
        }
    };
})();