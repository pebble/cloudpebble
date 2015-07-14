CloudPebble.FuzzyPrompt = (function() {
    var prompt, input, results;
    var previously_active;
    var sources = [];
    var item_list = [];
    var fuse;
    var initialised = false;
    var selected_id = null;
    var manual = false;


    var init = function() {
        if (!initialised) {
            var options = {
                caseSensitive: false,
                includeScore: false,
                shouldSort: true,
                threshold: 0.6,
                location: 0,
                distance: 100,
                maxPatternLength: 32,
                keys: ["name"]
            };
            fuse = new Fuse([], options);

            input = $('#fuzzy-prompt-input-value');
            prompt = $('#fuzzy-prompt');
            results = $('#fuzzy-results');

            prompt.keydown(function (e) {
                // Ctrl-P to hide
                if (e.ctrlKey && e.keyCode == 80) {
                    hide_prompt();
                }
                else if (e.keyCode == 13) {
                    select_match(item_list[selected_id]);
                }
                else if (e.keyCode == 40) {
                    move(1);
                    e.preventDefault();
                }
                else if (e.keyCode == 38) {
                    move(-1);
                    e.preventDefault();
                }

            });
            prompt.on('input', function() {
                var matches = current_matches();

                results.empty();

                if (matches.length > 0) {
                    _.each(matches, function(match, rank) {
                        match.menu_item.appendTo(results);
                        match.rank = rank;
                    });
                    if (!manual || !(_.chain(matches).pluck('id')).contains(selected_id).value()) {
                        select_item(matches[0]);
                    }
                }
                else {
                    selected_id = null;
                    manual = false;
                }
            });
            prompt.on('shown.bs.modal', function () {
                input.focus();
                input.val("");
            });
        }
    };

    var move = function(jump) {
        var selected = item_list[selected_id];
        var children = results.children();
        var new_rank = Math.max(Math.min(selected.rank + jump, children.length-1), 0);
        var new_selection = _.where(item_list, {rank: new_rank})[0];
        manual = true;
        select_item(new_selection);

    };

    var current_matches = function() {
        if (input.val().length == 0) {
            return item_list;
        }
        else {
            return fuse.search(input.val());
        }
    };

    var select_match = function(match) {
        match.callback(match.object);
        hide_prompt();
    };

    var show_prompt = function() {
        previously_active = document.activeElement;
        prompt.modal('show');
        item_list = [];
        results.empty();
        manual = false;
        // Build up the list of files to search through
        var id = 0;
        _.each(sources, function(source) {
            _.each(source.list_func(), function(object, name) {
                var menu_item = $("<div></div>");
                menu_item.text(name).appendTo(results);
                item_list.push({
                    'name': name,
                    'callback': source.callback,
                    'object': object,
                    'id': id,
                    'menu_item': menu_item,
                    'rank': id
                });
                id ++;
            });
        });
        fuse.set(item_list);
        select_item_by_id(0);
    };

    var select_item = function(item) {
        select_item_by_id(item.id);
    };

    var select_item_by_id = function(id) {
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

    var hide_prompt = function() {
        prompt.modal('hide');
        setTimeout(function() {
            $(previously_active).focus();
        }, 1);

    };

    return {
        Show: function() {
            show_prompt();
        },
        Toggle: function() {
            if ((prompt.data('bs.modal') || {}).isShown) {
                hide_prompt();
            }
            else {
                show_prompt();
            }
        },
        AddDataSource: function(item_getter, select_callback) {
            sources.push({list_func: item_getter, callback: select_callback});
        },
        Init: function() {
            init();
        }
    }
})();