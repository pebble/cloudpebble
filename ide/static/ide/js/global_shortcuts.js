CloudPebble.GlobalShortcuts = (function () {
    var global_shortcuts = {};

    var keymap = _.extend({}, CodeMirror.keyMap.basic, CodeMirror.keyMap.default);

    $(document).keydown(function (e) {
        if (!e.isDefaultPrevented()) {
            var shortcut = global_shortcuts[CodeMirror.keyName(e)];
            if (shortcut) {
                e.preventDefault();
                shortcut.func(e);
            }
        }
    });

    function shortcut_for_command(command) {
        // If the command is a name like "save", get they key-combo from CodeMirror
        if (!(command.indexOf('-') > -1)) {
            command = _.findKey(keymap, _.partial(_.isEqual, command));
        }

        // If any of the shortcut items are "platformcmd", convert them to 'Ctrl' or 'Cmd' depending on the platform.
        function key_for_platform(name) {
            if (name.toLowerCase() == "platformcmd") {
                return /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'
            } else return name;
        }

        return command.split('-').map(key_for_platform).join('-');
    }

    return {
        /** Add or replace global shortcuts
         *
         * @param {Object} shortcuts The keys of this object must be strings which represent keyboard shortcuts.
         * They can Codemirror-compatible shortcut descriptors e.g. "Shift-Cmd-V", or they can reference CodeMirror
         * commands such as "Save".
         * The values should be objects which have a descriptive "name" property, and also either have a "func" property
         * or be functions themselves. For example, a named function fully satisfies the requirements, as does an object
         * such as {name: "My Function", func: my_anonymous_function}
         */
        SetShortcutHandlers: function (shortcuts) {
            _.each(shortcuts, function (descriptor, key) {
                var shortcut = shortcut_for_command(key);
                global_shortcuts[shortcut] = {
                    name: descriptor.name ? descriptor.name : key,
                    func: _.isFunction(descriptor) ? descriptor : descriptor.func
                };
            });
        },
        GetShortcuts: function() {
            return global_shortcuts;
        },
        GetShortcutForCommand: function(name) {
            return shortcut_for_command(name);
        }
    }
})();
