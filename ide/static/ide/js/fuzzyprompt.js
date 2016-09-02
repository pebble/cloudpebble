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
        this.menu_item = opts.menu_item;
        this.subsection = opts.subsection;
    };

    var init = function() {
        if (!initialised) {
            // Set up the fuzzy matcher
            var options = {
                caseSensitive: false,
                sortFn: function(a, b) {
                    return (a.score === b.score) ? a.item.name.localeCompare(b.item.name) : a.score - b.score;
                },
                shouldSort: true,
                threshold: 0.5,
                location: 0,
                distance: 40,
                keys: [{
                    name: 'name',
                    weight: 0.8
                }, {
                    name: 'subsection',
                    weight: 0.2
                }]
            };
            fuse = new Fuse([], options);

            input = $('#fuzzy-prompt-input-value');
            prompt = $('#fuzzy-prompt');
            results = $('#fuzzy-results');

            var modifier = /Mac/.test(navigator.platform) ? 'metaKey' : 'ctrlKey';

            // Register ctrl-p and ctrl-shift-p
            CloudPebble.GlobalShortcuts.SetShortcutHandlers({
                'PlatformCmd-P': {
                    func: function() {
                        input.attr('placeholder', gettext("Search Files"));
                        show_prompt('files');
                    },
                    name: gettext("Find File")
                },
                'Shift-PlatformCmd-P': {
                    func: function() {
                        input.attr('placeholder', gettext("Enter Command"));
                        show_prompt('commands');
                    },
                    name: gettext("Find Action")
                }
            });

            prompt.keydown(function(e) {
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
                    render_list(matches);
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

            prompt.on('shown.bs.modal', function() {
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
                return item_list;//_.sortBy(item_list, 'name');
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
        _.each(sources, function(source) {
            if (source.kind == kind) {
                if ((_.isFunction(source.should_show) && source.should_show()) || source.should_show === true) {
                    _.each(source.list_func(), function(object, name) {
                        name = (!_.isFunction(object) && object.name ? object.name : name);
                        var menu_item = $("<div></div>").append('<span>').text(name);
                        if (object.hint) {
                            menu_item.append($('<span>').addClass('fuzzy-hint').text(object.hint));
                        }

                        item_list.push(new Item({
                            name: name,
                            callback: source.callback,
                            object: object,
                            menu_item: menu_item,
                            subsection: source.subsection
                        }));
                        id++;
                    });
                }
            }
        });
        item_list = _.sortBy(item_list, 'name');
        var id = 0;
        _.each(item_list, function(item) {
            // Set up the menu item handler
            (function() {
                var this_id = id;
                item.id = id;
                item.rank = id;
                item.menu_item.on('click', function() {
                    select_item(item_list[this_id]);
                });
                id += 1;
            })();
        });

        fuse.set(item_list);
        item_list = _.sortBy(item_list, 'name');
        render_list(item_list);

        // Select the current item by default, or the first item.
        highlight_item(_.findWhere(item_list, {name: default_item}) || item_list[0]);
    };

    function render_list(item_list) {
        var grouped = _.groupBy(item_list, 'subsection');
        var sections = _.keys(grouped);
        function add_items(current_rank, items) {
            _.each(items, function(item) {
                item.rank = current_rank;
                results.append(item.menu_item);
                current_rank +=1;
            });
            return current_rank;
        }

        if (sections.length === 1) {
            if (sections[0] != 'undefined') {
                results.append($('<div>').text(sections[0]).addClass('fuzzy-subheader'));
            }
            add_items(0, item_list);
            // results.append(_.pluck(item_list, 'menu_item'));
        }
        else {
            var found = {};
            var ordered = [];
            var i = 0;
            _.some(item_list, function(item) {
                if (!_.has(found, item.subsection)) {
                    found[item.subsection] = true;
                    ordered.push(item.subsection);
                    i += 1;
                }
                if (i == sections.length) return true;
            });
            var rank = 0;
            _.each(ordered, function(name) {
                results.append($('<div>').text(name).addClass('fuzzy-subheader'));
                rank = add_items(rank, grouped[name]);
            });
        }
    }

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
                setTimeout(function() {
                    $(previously_active).focus();
                }, 1);
            }
            else {
                prompt.blur();
            }
            submit_analytics(selection);
        }
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
         * @param {Function|Boolean} should_show Whether to actually show the commands. Either true, or a function which returns a boolean.
         */
        AddDataSource: function(kind, item_getter, select_callback, should_show) {
            if (_.isUndefined(should_show)) should_show = true;
            sources.push({
                list_func: item_getter,
                callback: select_callback,
                kind: kind,
                should_show: should_show
            });
        },
        /** Add a set of commands
         *
         * @param {Object.<string, Function>} commands A dictionary of names->functions
         * @param {Function|Boolean} should_show Whether to actually show the commands.
         */
        AddCommands: function(subsection, commands, should_show) {
            if (_.isUndefined(should_show)) should_show = true;
            sources.push({
                list_func: function() {
                    return commands;
                },
                callback: function(func) {
                    func();
                },
                kind: 'commands',
                should_show: should_show,
                subsection: subsection
            });
            // CloudPebble.FuzzyPrompt.AddDataSource('commands', , , should_show);
        },
        Init: function() {
            init();
        }
    }
})();