CloudPebble.FuzzyPrompt = (function() {
    var fuse;
    var prompt, input, results;
    var previously_active;
    var sources = [];
    var item_list = [];
    var initialised = false;
    var selected_id = null;
    var default_item;
    var selection_was_made;
    var opened = false;
    var prompt_kind = null;

    // While manual is false, always highlight the first item
    var manual = false;

    /** A FuzzyPrompt Item.
     *
     * @param opts Item parameters;
     * @constructor
     */
    var Item = function(opts) {
        this.name = opts.name;
        this.callback = opts.callback;
        this.object = opts.object;
        this.id = opts.id;
        this.menu_item = opts.menu_item;
        this.rank = opts.rank
    };

    var init = function() {
        if (!initialised) {
            // Set up the fuzzy matcher
            var options = {
                caseSensitive: false,
                includeScore: false,
                shouldSort: true,
                threshold: 0.4,
                location: 0,
                distance: 20,
                keys: ["name"]
            };
            fuse = new Fuse([], options);

            input = $('#fuzzy-prompt-input-value');
            prompt = $('#fuzzy-prompt');
            results = $('#fuzzy-results');

            var modifier = /Mac/.test(navigator.platform) ? 'metaKey' : 'ctrlKey';

            // Register ctrl-p and ctrl-shift-p
            $(document).keydown(function(e) {
                if ((e[modifier]) && e.keyCode == 80) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        input.attr('placeholder', gettext("Enter Command"));
                        show_prompt('commands');
                    }
                    else if (!e.shiftKey) {
                        input.attr('placeholder', gettext("Search Files"));
                        show_prompt('files');
                    }
                }
            });

            prompt.keydown(function (e) {
                // Ctrl-P to hide
                if (opened && e[modifier] && e.keyCode == 80) {
                    hide_prompt(true);
                    e.preventDefault();
                    e.stopPropagation();
                }
                // Enter to select
                else if (e.keyCode == 13) {
                    select_item(item_list[selected_id]);
                    e.preventDefault();
                    e.stopPropagation();
                }
                // Up and down to switch between items
                // Use e.preventDefault so arrow keys don't navigate the text
                else if (e.keyCode == 40) {
                    move(1);
                    e.preventDefault();
                }
                else if (e.keyCode == 38) {
                    move(-1);
                    e.preventDefault();
                }
            });

            input.on('blur', function() {
                hide_prompt(true);
            });

            prompt.on('input', function() {
                var matches = current_matches();

                // Reset the results list
                results.empty();
                _.each(item_list, function(item) {
                    item.rank = null;
                });

                // Then build the new results list
                if (matches.length > 0) {
                    _.each(matches, function(match, rank) {
                        match.menu_item.appendTo(results);
                        // The item's rank is its current position in the suggestion list.
                        match.rank = rank;
                    });
                    // Highlight the first item if the previously highlighted item disappears
                    // or the user has not been using the arrow keys
                    if (!manual || !(_.chain(matches).pluck('id')).contains(selected_id).value()) {
                        highlight_item(matches[0]);
                    }
                }
                else {
                    // If there are no results, go back to highlighting the top item
                    manual = false;
                    selected_id = null;
                }
            });

            prompt.on('shown.bs.modal', function () {
                input.focus();
                input.val("");
            });

            prompt.on('hidden.bs.modal', function() {
                opened = false;
            });
        }
    };

    // Move the highlight cursor up or down by 'jump' places.
    var move = function(jump) {
        var selected = item_list[selected_id];
        var children = results.children();
        var new_rank = Math.max(Math.min(selected.rank + jump, children.length - 1), 0);
        var new_selection = _.where(item_list, {rank: new_rank})[0];
        manual = true;
        highlight_item(new_selection);
    };

    // Get all items which fuzzily match the input string
    // or if the input string is empty, return all the items
    var current_matches = function() {
        var parts = input.val().split(":", 2);
        if (parts[0].length == 0) {
            if (_.isUndefined(parts[1]))
                return item_list;
            else {
                return _.where(item_list, {name: default_item});
            }
        }
        else {
            return fuse.search(parts[0]);
        }
    };

    // Select an item, run its callback then hide the prompt
    var select_item = function(match) {
        selection_was_made = (match != null);
        hide_prompt(!selection_was_made, match);
        if (match) {
            match.callback(match.object, input.val());
        }
    };

    var show_prompt = function(kind) {
        var prompt_already_open = false;
        $('.modal').each(function() {
            if ($(this).hasClass('in')) {
                prompt_already_open = true;
                return false;
            }
        });
        if (prompt_already_open) return;
        previously_active = document.activeElement;
        prompt.modal('show');
        item_list = [];
        results.empty();
        manual = false;
        selection_was_made = false;
        opened = true;
        prompt_kind = kind;
        // Build up the list of files to search through
        var id = 0;
        _.each(sources, function(source) {
            if (source.kind == kind) {
                _.each(source.list_func(), function (object, name) {
                    name = (!_.isFunction(object) && object.name ? object.name : name);
                    var menu_item = $("<div></div>");
                    menu_item.text(name).appendTo(results);
                    // Set up the menu item handler
                    (function () {
                        var this_id = id;
                        menu_item.on('click', function () {
                            select_item(item_list[this_id]);
                        });
                    })();

                    item_list.push(new Item({
                        name: name,
                        callback: source.callback,
                        object: object,
                        id: id,
                        menu_item: menu_item,
                        rank: id
                    }));
                    id++;
                });
            }
        });
        fuse.set(item_list);

        // Select the current item by default, or the first item.
        highlight_item(_.findWhere(item_list, {name: default_item}) || item_list[0]);
    };

    /** Highlight an item in the suggestions list. If enter is hit, the highlighted item gets selected.
     *
     * @param {Item} item An item object.
     */
    var highlight_item = function(item) {
        if (_.isObject(item)) {
            highlight_item_by_id(item.id);
        }
    };
    var highlight_item_by_id = function(id) {
        _.each(item_list, function(item) {
            if (item.id == id) {
                item.menu_item.addClass('selected');
            }
            else {
                item.menu_item.removeClass('selected');
            }
        });
        selected_id = id;
    };

    var submit_analytics = function(selection) {
        // If there is a dot in the name (and hence, the item is a file), only submit the extension.
        var data = {
            kind: prompt_kind,
            selection: (selection ? selection.name.split('.').pop() : null)
        };
        CloudPebble.Analytics.addEvent("cloudpebble_fuzzyprompt_action", data, null, ['cloudpebble']);
    };

    // Hide the prompt and refocus on the last thing.
    var hide_prompt = function(refocus, selection) {
        if (opened) {
            opened = false;
            prompt.modal('hide');
            if (refocus) {
                setTimeout(function () {
                    $(previously_active).focus();
                }, 1);
            }
            else {
                prompt.blur();
            }
            submit_analytics(selection);
        }
    };

    var add_commands = function(commands) {
        sources.push({
            list_func: function() {return commands;},
            callback: function(func) {func();},
            kind: 'commands'
        });
    };

    return {
        /** Let fuzzy-prompt know the name of the currently open file/location to use as a default
         * when nothing has been typed.
         *
         * @param {string} item_name The name of the command to default to.
         */
        SetCurrentItemName: function(item_name) {
            if (!opened) {
                default_item = item_name;
            }
        },
        /** Show the fuzzy prompt. */
        Show: function() {
            show_prompt();
        },
        /** Add a data source.
         *
         * @param {string} kind 'files' or 'commands'
         * @param {Function} item_getter A function which should return a dict of items with string name keys
         * @param {Function} select_callback A function to call when one of these items is selected
         */
        AddDataSource: function(kind, item_getter, select_callback) {
            sources.push({list_func: item_getter, callback: select_callback, kind: kind});
        },
        /** Add a set of commands
         *
         * @param {Object.<string, Function>} commands A dictionary of names->functions
         */
        AddCommands: function(commands) {
            add_commands(commands);
        },
        /** Add a new set of commands, replacing any identically named commands
         *
         * @param {Object.<string, Function>} commands A dictionary of names->functions
         */
        ReplaceCommands: function(commands) {
            // For each new command, look through the data source for
            // commands with the same name. If we find any, replace their functions
            // with the new one.
            var all_replaced = [];

            _.each(commands, function(newfunc, compare_key) {
                _.each(sources, function (source) {
                    if (source.kind == 'commands') {
                        var source_commands = source.list_func();
                        _.each(source_commands, function (func, key) {
                            if (compare_key == key) {
                                source_commands[key] = newfunc;
                                // Keep track of the fact that this command was replaced
                                all_replaced.push(key);
                            }
                        });
                        source.list_func = function() {return source_commands};
                    }
                });
            });

            // At the end, we add any commands in the set which were new and note replacements.
            var filtered = _.omit(commands, all_replaced);
            add_commands(filtered);
        },
        Init: function() {
            init();
        }
    }
})();