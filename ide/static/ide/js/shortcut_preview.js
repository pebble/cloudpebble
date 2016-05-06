CloudPebble.ShortcutPreview = (function () {
    function neaten_command_name(str) {
        var result = str.replace(/(\S)([A-Z])/g, '$1 $2').replace(/^./, function(str){ return str.toUpperCase(); });
        result = result.replace('Doc ', 'Document ');
        result = result.replace('Go ', 'Go To ');
        result = result.replace('Del ', 'Delete ');
        return result;
    }

    function find_all_shortcuts() {
        // Get descriptions for all global IDE shortcuts
        var global = _.chain(CloudPebble.GlobalShortcuts.GetShortcuts())
            .mapObject(function(handler) {return neaten_command_name(handler.name)})
            .pick(_.identity)
            .value();

        // Get descriptions for CodeMirror bindings
        var editor = _.chain(CodeMirror.keyMap[USER_SETTINGS.keybinds])
            .omit(function(value, key) {
                return !_.isString(value) || _.contains(_.keys(global), key);
            })
            .mapObject(neaten_command_name)
            .value();

        // Get descriptions for all custom-defined CodeMirror shortcuts
        var special = _.pick(_.extend.apply(null, _.map(CloudPebble.Editor.GetAllEditors(), function(ed) {
            return _.mapObject(ed.options.extraKeys, function(func) {
                return neaten_command_name(func.name)
            });
        })), _.identity);

        var result = [
            {name: gettext('Global Commands'), shortcuts: global},
            {name: gettext('Special Editor Commands'), shortcuts: special},
            {name: gettext('Editor Commands'), shortcuts: editor}
        ];
        result[gettext('Editor')] = editor;
        result[gettext('Global')] = global;
        return result;
    }

    return {
        DisplayShortcutHelp: function() {
            var shortcuts = find_all_shortcuts();
            var table = $('<table>').append(_.flatten(_.map(shortcuts, function(category) {
                var title = $('<tr colspan="2"><td><h3></h3></td></tr>').find('h3').text(category.name);
                var items = _.map(category.shortcuts, function(name, shortcut) {
                    return $('<tr>').append($('<td>').text(name)).append($('<td>').text(shortcut));
                });
                return [title, items]
            })));
            $('#shortcut-prompt .modal-body').empty().append(table);
            $('#shortcut-prompt').modal();
        }
    }
})();
