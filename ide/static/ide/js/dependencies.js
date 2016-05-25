CloudPebble.Dependencies = (function() {
    var dependencies_template = null;

    /**
     * Set up the package search form.
     * @param form_element A form element containing a textarea.
     * @param on_submit A callback taking arguments (name, version) called when the user selects a package.
     */
    function setup_npm_search_form(form_element, on_submit) {
        var version_prefix = '^';
        var textarea_element = form_element.find('textarea');
        var version_cache = {};
        // Configure a textext entry to autocomplete package names by searching node-modules.com

        // ajax: {crossDomain: true} is required to prevent CORS errors.
        var textext = textarea_element.textext({
            plugins: 'focus prompt ajax autocomplete',
            prompt: gettext('Search NPM...'),
            ajax: {
                url: 'http://node-modules.com/search.json',
                dataType: 'json',
                crossDomain: true,
                cache: true
            },
            autocomplete: {
                render: function (element) {
                    // This renders suggestions as the package name in bold, followed by the description
                    var elm = $('<span></span>').addClass('package-suggestion').click(function () {
                        $(this).parent().click();
                    });
                    $('<span></span>').text(element.name).addClass('package-suggestion-name').appendTo(elm);
                    $('<span></span>').text(element.description).appendTo(elm);
                    return elm;
                }
            },
            ext: {
                itemManager: {
                    itemToString: function (item) {
                        return item.name;
                    },
                    stringtoItem: function (string) {
                        return {name: string}
                    }
                },
                ajax: {
                    onComplete: function (data, query) {
                        // This intercepts the Ajax search results callback in order to
                        // keep a cache of which modules are at which versions.
                        // When the user selects a package, we can use this cache to look up
                        // the package's version number.
                        _.extend(version_cache, _.object(_.map(data, function (o) {
                            return [o.name, o.version];
                        })));
                        $.fn.textext.TextExtAjax.prototype.onComplete.apply(this, [data, query]);
                    }
                }
            }
        }).textext()[0];

        textext.on({
            'enterKeyDown': function (e) {
                if (!textext.autocomplete().isDropdownVisible()) {
                    form_element.submit();
                }
            }
        });

        form_element.submit(function (e) {
            e.preventDefault();
            var val = textext.input().val().trim();
            if (!val) return;
            var version = version_cache[val];
            // If the package is not in the version cache, look up the package on node-modules.com
            // directly and check the version there. If it is not there either, the callback is called
            // with version = null.
            if (version) {
                on_submit(val, version_prefix+version);
            }
            else {
                var url = "http://node-modules.com/package/" + encodeURI(val) + ".json";
                $.ajax({
                    url: url,
                    crossDomain: true,
                    dataType: 'json'
                }).then(function (data) {
                    on_submit(val, data.version ? version_prefix+data.version : null);
                }).fail(function () {
                    on_submit(val, null);
                });
            }
        });

        return textext;
    }

    function setup_dependencies_table(table) {
        return new CloudPebble.KVTable(table, {
            key_name: gettext('Package Name'),
            value_name: gettext('Version'),
            value_type: 'text',
            data: _.pairs(CloudPebble.ProjectInfo.app_dependencies),
            key_placeholder: gettext('New Entry'),
            default_value: null
        });
    }

    function save(values) {
        var dependencies = {};
        // Don't save yet if there are any incomplete values
        if (_.some(_.flatten(values), function(x) {return !x.trim()})) {
            return {incomplete: true};
        }
        // Error if there are duplicate keys
        _.each(values, function(tuple) {
            if (_.has(dependencies, tuple[0])) {
                throw new Error(gettext('Duplicate dependencies'));
            }
            dependencies[tuple[0]] = tuple[1];
        });
        return Ajax.Post('/ide/project/' + PROJECT_ID + '/save_dependencies', {'dependencies': JSON.stringify(dependencies)});

    }


    function setup_dependencies_pane(pane) {
        var npm_search_form = pane.find('#dependencies-search-form');
        var dependencies_table = pane.find('#dependencies-table');

        var kv_table;

        function display_error(error) {
            pane.find('.alert-error').removeClass('hide').text(error);
        }

        function hide_error() {
            pane.find('.alert-error').addClass('hide');
        }

        function save_form() {
            return save(kv_table.getValues());
        }

        // setTimeout is required due to a limitation/bug in the textext library.
        setTimeout(function() {
            var live_form = make_live_settings_form({
                save_function: save_form,
                on_save_function: hide_error,
                error_function: display_error,
                form: pane.find('#dependencies-form'),
                label_selector: 'button',
                group_selector: 'tr',
                on_change_function: function(elm) {
                    return $(elm).parents('tr').find('input').filter(function(){return !$(this).val()}).length == 0;
                }
            });

            kv_table = setup_dependencies_table(dependencies_table);
            dependencies_table.on('rowDeleted', function() {
                live_form.save(dependencies_table.find('tr:last-child'));
            });
            dependencies_table.on('rowAdded', function(e, info) {
                live_form.addElement($(info.element), !!info.key);
                live_form.save($(info.element));
            });

            // When a user enters a value in the search form, add it to the table and clear the search.
            var search_form = setup_npm_search_form(npm_search_form, function(name, version) {
                search_form.input().val('');
                search_form.hiddenInput().val('');
                kv_table.addValue(name, version);
            });
            live_form.init();
        });
    }

    function show_dependencies_pane() {
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("dependencies")) {
            return;
        }
        ga('send', 'event', 'project', 'load dependencies');

        setup_dependencies_pane(dependencies_template);

        CloudPebble.Sidebar.SetActivePane(dependencies_template, 'dependencies');
    }


    return {
        Show: function() {
            show_dependencies_pane();
        },
        Init: function() {
            var commands = {};
            commands[gettext("Dependencies")] = CloudPebble.Dependencies.Show;
            CloudPebble.FuzzyPrompt.AddCommands(commands);
            dependencies_template = $('#dependencies-pane-template').remove().removeClass('hide');
        }
    };
})();
