CloudPebble.Sidebar = (function() {

    var suspended_panes = {};
    var mProjectType = 'native';

    var suspend_active_pane = function() {
        var pane_id = $('#main-pane').data('pane-id');
        if(!pane_id) {
            destroy_active_pane();
            $('#pane-parent').append($('<div id="main-pane"></div>'));
            return;
        }
        var pane = $('#main-pane');

        var suspend_function = pane.data('pane-suspend-function');
        if(suspend_function) suspend_function();

        var list_entry = $('#sidebar-pane-' + pane_id);
        if(list_entry) {
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
        if(pane.data('pane-destroy-function')) {
            pane.data('pane-destroy-function')(pane);
        }
        pane.remove();
        var list_entry = $('#sidebar-pane-' + pane_id);
        if(list_entry) {
            list_entry.removeClass('active');
        }
    };

    var restore_suspended_pane = function(id) {
        var pane = suspended_panes[id] ;
        if(pane) {
            $('#main-pane').remove();
            $('#pane-parent').append(pane);
            delete suspended_panes[id];

            var list_entry = $('#sidebar-pane-' + id);
            if(list_entry) {
                list_entry.addClass('active');
            }

            if(pane.data('pane-restore-function')) {
                pane.data('pane-restore-function')();
            }

            return true;
        }
        return false;
    };

    var set_main_pane = function(pane, options) {
        $('#main-pane').append(pane).data('pane-id', options.id);
        if(options.onRestore) {
            $('#main-pane').data('pane-restore-function', options.onRestore);
        }
        if(options.onDestroy) {
            $('#main-pane').data('pane-destroy-function', options.onDestroy);
        }
        if(options.onSuspend) {
            $('#main-pane').data('pane-suspend-function', options.onSuspend);
        }
    };

    var set_active_menu_entry = function(id) {
        $('#sidebar-pane-' + id).addClass('active');
    };

    var init = function() {
    };

    return {
        SuspendActive: function() {
            suspend_active_pane();
        },
        DestroyActive: function() {
            destroy_active_pane();
        },
        Restore: function(id) {
            var restored = restore_suspended_pane(id);
            if(restored) {
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
            var end = $('#end-resources-' + resource.kind);
            if(!end.length) {
                // Create an appropriate section
                var res_end = $('#end-resources');
                end = $('<li id="end-resources-' + resource.kind + '" class="divider">');
                res_end.before(end);
            }
            var link = $('<a href="#"></a>').text(resource.file_name+" ").click(on_click);
            var li = $('<li id="sidebar-pane-resource-' + resource.id + '">');
            li.append(link);
            end.before(li);
            return li;
        },
        SetItemName: function(kind, id, new_name) {
            // We need to keep any icons
            var link = $('#sidebar-pane-'+kind+'-'+id+' a');
            var icons = link.children();
            icons.detach();
            link.text(new_name + ' ').append(icons);
        },
        AddSourceFile: function(file, on_click) {
            var end = $('#end-source-files');
            if(file.target == 'worker') {
                end = $('#end-worker-files');
                $('#worker-files').show();
                $('#source-files').find('span:first').text(gettext("App source"));
            }
            var link = $('<a href="#" id="sidebar-link-'+file.id+'"></a>');
            link.text(file.name + ' ');
            link.click(on_click);
            var li = $('<li id="sidebar-pane-source-'+file.id+'">');
            li.append(link);
            end.before(li);
            return li;
        },
        AddTestFile: function(file, on_click) {
            var end = $('#end-test-files');
            var link = $('<a href="#" id="sidebar-link-'+file.id+'"></a>');
            link.text(file.name + ' ');
            link.click(on_click);
            var li = $('<li id="sidebar-pane-test-'+file.id+'">');
            li.append(link);
            end.before(li);
            return li;
        },
        Remove: function(id) {
            $('#sidebar-pane-' + id).remove();
        },
        SetIcon: function(pane_id, icon) {
            var a = $('#sidebar-pane-' + pane_id).find('a');
            var i = a.find('i');
            if(i.length === 0) {
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
            $('#sidebar-pane-settings > a').click(CloudPebble.Settings.Show);
            $('#sidebar-pane-testmanager > a').click(CloudPebble.TestManager.Show);
            $('#sidebar-pane-github > a').click(CloudPebble.GitHub.Show);
            $('#sidebar-pane-timeline > a').click(CloudPebble.Timeline.show);
            $('#new-source-file').click(CloudPebble.Editor.Create);
            $('#new-test').click(CloudPebble.Editor.CreateTest);

            var commands = {};
            commands[gettext("Add New Resource")] = CloudPebble.Resources.Create;
            commands[gettext("Compilation")] = CloudPebble.Compile.Show;
            commands[gettext("Settings")] = CloudPebble.Settings.Show;
            commands["GitHub"] = CloudPebble.GitHub.Show;
            commands[gettext("Timeline")] = CloudPebble.Timeline.show;
            commands[gettext("Add New Source File")] = CloudPebble.Editor.Create;
            commands[gettext("Add New Test")] = CloudPebble.Editor.CreateTest;
            CloudPebble.FuzzyPrompt.AddCommands(commands);

            init();
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
            }).click(function() { $(this).popover('hide'); });
        },
        SetProjectType: function(type) {
            if(type != 'native') {
                $('.native-only').hide();
            }
            if(type == 'simplyjs') {
                $('.not-simplyjs').hide();
            }
        }
    };
})();