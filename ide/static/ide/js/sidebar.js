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

    var set_main_pane = function(pane, id, restore_function, destroy_function) {
        $('#main-pane').append(pane).data('pane-id', id);
        if(restore_function) {
            $('#main-pane').data('pane-restore-function', restore_function);
        }
        if(destroy_function) {
            $('#main-pane').data('pane-destroy-function', destroy_function);
        }
    };

    var set_active_menu_entry = function(id) {
        $('#sidebar-pane-' + id).addClass('active');
    };

    var init = function() {
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
            if(restored) {
                set_active_menu_entry(id);
            }
            return restored;
        },
        SetActivePane: function(pane, id, restore_function, destroy_function) {
            set_main_pane(pane, id, restore_function, destroy_function);
            set_active_menu_entry(id);
        },
        AddResource: function(resource, on_click) {
            var end = $('#end-resources-' + resource.kind);
            if(!end.length) {
                // Create an appropriate section
                var res_end = $('#end-resources');
                end = $('<li id="end-resources-' + resource.kind + '" class="divider">');
                res_end.before(end);
            }
            var link = $('<a href="#"></a>').text(resource.file_name).click(on_click);
            var li = $('<li id="sidebar-pane-resource-' + resource.id + '">');
            li.append(link);
            end.before(li);
            return li;
        },
        AddSourceFile: function(file, on_click) {
            var end = $('#end-source-files');
            var link = $('<a href="#"></a>');
            link.text(file.name + ' ');
            link.click(on_click);
            var li = $('<li id="sidebar-pane-source-'+file.id+'">');
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
            $('#sidebar-pane-github > a').click(CloudPebble.GitHub.Show);
            $('#new-source-file').click(CloudPebble.Editor.Create);
            $('#new-js-file').click(CloudPebble.Editor.DoJSFile);
            init();
        },
        SetPopover: function(pane_id, title, content) {
            $('#sidebar-pane-' + pane_id).popover('destroy').popover({
                trigger: 'hover',
                title: title,
                content: content,
                html: true,
                delay: {show: 250}
            }).click(function() { $(this).popover('hide'); });
        },
        SetProjectType: function(type) {
            if(type == 'simplyjs') {
                $('.native-only').hide();
            }
        }
    };
})();