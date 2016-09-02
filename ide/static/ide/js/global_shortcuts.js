CloudPebble.GlobalShortcuts = (function () {
    var global_shortcuts = {};

    // Build a full map of CodeMirror shortcuts by checking for the 'fallthrough' property
    // and integrating any sub-keymaps of the main one.
    var codemirror_full_keymap = _.clone(CodeMirror.keyMap[USER_SETTINGS.keybinds]);
    if (codemirror_full_keymap.fallthrough) {
        _.each(codemirror_full_keymap.fallthrough, function(sub_map) {
            _.defaults(codemirror_full_keymap, CodeMirror.keyMap[sub_map]);
        });
        delete codemirror_full_keymap.fallthrough;
    }

    $(document).keydown(function (e) {
        if (!e.isDefaultPrevented()) {
            var shortcut = global_shortcuts[CodeMirror.keyName(e)];
            if (shortcut) {
                e.preventDefault();
                shortcut.func(e);
            }
        }
    });

    function shortcut_for_command(command, commands) {
        var look_through =  _.isObject(commands) ? commands : codemirror_full_keymap;
        // If the command is a name like "save", get they key-combo from CodeMirror
        if (!(command.indexOf('-') > -1)) {
            command = _.findKey(look_through, _.partial(_.isEqual, command));
        }

        // If any of the shortcut items are "platformcmd", convert them to 'Ctrl' or 'Cmd' depending on the platform.
        function key_for_platform(name) {
            if (name.toLowerCase() == "platformcmd") {
                return /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'
            } else return name;
        }

        if (!command) {
            return null;
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
                if (shortcut) {
                    global_shortcuts[shortcut] = {
                        name: descriptor.name ? descriptor.name : key,
                        func: _.isFunction(descriptor) ? descriptor : descriptor.func
                    };
                }
            });
        },
        GetShortcuts: function() {
            return global_shortcuts;
        },
        GetCodemirrorShortcuts: function() {
            return codemirror_full_keymap;
        },
        GetShortcutForCommand: function(name, extras) {
            return shortcut_for_command(name, extras);
        }
    }
})();
