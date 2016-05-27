CloudPebble.Dependencies = (function() {
    var dependencies_template = null;

    var SUGGEST_CACHED = true;
    var IMMEDIATE_RESULTS = false;

    function ModuleCache() {
        this.cache = {};
        _.extend(this, Backbone.Events);
    }

    /** Update the module cache with a list of modules (e.g. from node-modules.com)
     *
     * @param data An array of objects which should have name, author, version and description attributes
     * @fires 'update'
     */
    ModuleCache.prototype.update_modules = function(data) {
        _.extend(this.cache, _.object(_.map(data, function(o) {
            if (o._id) o.name = o._id;
            return [o.name, o];
        })));
        this.trigger('update', this.cache);
    };

    /** Look up a module on node-modules or from the cache
     *
     * @param name Name of the module to look up
     * @returns {Promise} A promise which resolves with the module details if it exists.
     */
    ModuleCache.prototype.lookup_module = function(name) {
        var cached = this.cache[name];
        if (cached) {
            return Promise.resolve(cached);
        }
        else {
            return (new Ajax.Wrapper('version')).ajax({
                url: "http://node-modules.com/package/" + encodeURI(name) + ".json",
                crossDomain: true,
                dataType: 'json'
            }).then(function(result) {
                this.update_modules([result]);
                return result;
            }.bind(this));
        }
    };

    /** Get a list of all cached modules
     * @returns {Array} Array of module objects
     */
    ModuleCache.prototype.get_list = function() {
        return _.values(this.cache);
    };

    var cache = new ModuleCache();

    /**
     * Set up the package search form.
     * @param form_element A form element containing a textarea.
     * @param on_submit A callback taking arguments (name, version) called when the user selects a package.
     */
    function setup_npm_search_form(form_element, on_submit) {
        var version_prefix = '^';
        var textarea_element = form_element.find('textarea');

        /** Deduplicate a list of modules
         *
         * @param data List of objects with name attributes
         * @returns {*} List of objects deduped by name attribute
         */
        function dedupe_results(data) {
            return _.uniq(data, false, function(item) {
                return item.name
            })
        }

        /** Search/filter/sort a list of package objects by text.
         *
         * Searches are done for name, description and then author and the results
         * are concatenated
         *
         * @param data List of objects with name, description and author attributes
         * @param query String query to sort/filter by
         * @returns {Array} Filtered array of objects, possibly duplicated.
         */
        function filter_results(data, query) {
            return _.flatten(['name', 'description', 'author'].map(function(key) {
                return (new Fuse(data, {keys: [key]})).search(query);
            }));
        }

        /** Sort a list of objects by running filter_results on them and then just
         *  tacking any unmatched objects on the end
         * @param data List of objects with name, description and author attributes
         * @param query String query to sort by
         * @returns {Array} Array of objects with unique names
         */
        function sort_results(data, query) {
            var searched = filter_results(data, query);
            var exact = _.find(data, {name: query});
            var full_list = _.flatten((exact ? [exact] : []).concat(searched).concat(data));
            return dedupe_results(full_list);
        }

        /** This renders suggestions as the package name in bold, followed by the description */
        function render_suggestion(item) {
            var elm = $('<span></span>').addClass('package-suggestion').click(function() {
                $(this).parent().click();
            });
            $('<span></span>').text(item.name).addClass('package-suggestion-name').appendTo(elm);
            $('<span></span>').text(item.description).appendTo(elm);
            return elm;
        }

        // Configure a textext entry to autocomplete package names by searching node-modules.com
        // ajax: {crossDomain: true} is required to prevent CORS errors.
        var textext = textarea_element.textext({
            plugins: 'focus prompt autocomplete suggestions ajax',
            prompt: gettext('Search NPM...'),
            suggestions: [],
            ajax: {
                url: 'http://node-modules.com/search.json',
                dataType: 'json',
                crossDomain: true,
                cache: true
            },
            autocomplete: {
                render: render_suggestion
            },
            ext: {
                itemManager: {
                    itemToString: function(item) {
                        return item.name;
                    },
                    stringtoItem: function(string) {
                        return {name: string}
                    },
                    filter: function(list, query) {
                        return dedupe_results(filter_results(list, query));
                    }
                },
                // This extention modifies textext so that it only keeps track of the selected item if you have
                // manually navigated the suggestion list.
                autocomplete: {
                    onShowDropdown: function(e, renderCallback) {
                        $.fn.textext.TextExtAutocomplete.prototype.onShowDropdown.apply(this, arguments);
                        if (!this.manual_control){
                            this.selectFirst();
                        }
                    },
                    selectFirst: function() {
                        this.clearSelected();
                        var all = this.suggestionElements();
                        var target = all.first();
                        target.addClass('text-selected');
                        this.scrollSuggestionIntoView(target);
                    },
                    hideDropdown: function() {
                        this.manual_control = false;
                        $.fn.textext.TextExtAutocomplete.prototype.hideDropdown.apply(this, arguments);
                    },
                    onDownKeyDown: function() {
                        this.manual_control = true;
                        $.fn.textext.TextExtAutocomplete.prototype.onDownKeyDown.apply(this, arguments);
                    },
                    onUpKeyDown: function() {
                        this.manual_control = true;
                        $.fn.textext.TextExtAutocomplete.prototype.onUpKeyDown.apply(this, arguments);
                    }
                },
                ajax: {
                    onComplete: function(data, query) {
                        // This intercepts the Ajax search results in order to update the package version cache and
                        // sort the results in a more 'autocomplete' type way.
                        cache.update_modules(data);
                        var fetched = sort_results(data, query);
                        if (SUGGEST_CACHED) {
                            var cached = filter_results(cache.get_list(), query);
                            var combined = dedupe_results(_.flatten([fetched, cached]));
                            var suggestions = sort_results(combined, query);
                            $.fn.textext.TextExtAjax.prototype.onComplete.apply(this, [suggestions, query]);
                        }
                        else {
                            $.fn.textext.TextExtAjax.prototype.onComplete.apply(this, [fetched, query]);
                        }
                    }
                }
            }
        }).textext()[0];

        cache.on('update', function() {
            if (IMMEDIATE_RESULTS) {
                textext._opts.suggestions = _.values(this.cache);
            }
        });

        textext.on({
            'enterKeyDown': function(e) {
                if (!textext.autocomplete().isDropdownVisible()) {
                    form_element.submit();
                }
            }
        });

        form_element.submit(function(e) {
            e.preventDefault();
            var val = textext.input().val().trim();
            if (!val) return;
            cache.lookup_module(val).then(function(data) {
                on_submit(val, data.version ? version_prefix + data.version : null);
            }).catch(function() {
                on_submit(val, null);
            });
        });

        return textext;
    }

    function setup_dependencies_table(table, live_form) {
        return new CloudPebble.KVTable(table, {
            key_name: gettext('Package Name'),
            value_name: gettext('Version'),
            value_type: 'text',
            data: _.pairs(CloudPebble.ProjectInfo.app_dependencies),
            key_placeholder: gettext('New Entry'),
            default_value: null
        }).on('rowDeleted', function() {
            // Save the table when a row is deleted
            live_form.save(table.find('tr:last-child'));
        }).on('rowAdded', function(info) {
            // Save the table when a row is added
            live_form.addElement($(info.element), !!info.key);
            live_form.save($(info.element));
        }).on('rowRendered', function(row) {
            // Add extra columns to each row, for displaying the latest version
            $('<td></td>').addClass('latest-version').appendTo(row);
        }).on('headRendered', function(row) {
            $('<th>').appendTo(row);
        }).init();
    }

    function save(values) {
        var dependencies = {};
        // Don't save yet if there are any incomplete values
        if (_.some(_.flatten(values), function(x) {
                return !x.trim()
            })) {
            return {incomplete: true};
        }
        // Error if there are duplicate keys
        _.each(values, function(tuple) {
            if (_.has(dependencies, tuple[0])) {
                throw new Error(gettext('Duplicate dependencies'));
            }
            dependencies[tuple[0]] = tuple[1];
        });
        return Ajax.Post('/ide/project/' + PROJECT_ID + '/save_dependencies', {
            'dependencies': JSON.stringify(dependencies)
        });

    }

    function lookup_all_dependencies(tuples) {
        return Promise.map(tuples, function(tuple) {
            return cache.lookup_module(tuple[0]).then(function(result) {
                return [result._id, result.version];
            }).catch(function() {
                return [tuple[0], null];
            });
        });
    }

    function setup_dependencies_pane(pane) {
        var npm_search_form = pane.find('#dependencies-search-form');
        var dependencies_table = pane.find('#dependencies-table');
        var dependencies_lookup = pane.find('#dependencies-lookup');

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
                label_selector: 'tr button',
                group_selector: 'tr'
            });

            kv_table = setup_dependencies_table(dependencies_table, live_form);

            var search_form = setup_npm_search_form(npm_search_form, function(name, version) {
                // When a user enters a value in the search form, add it to the table and clear the search.
                search_form.input().val('');
                search_form.hiddenInput().val('');
                kv_table.addValue(name, version);
            });

            dependencies_lookup.click(function() {
                lookup_all_dependencies(kv_table.getValues()).then(function(results) {
                    dependencies_table.find('tr:not(:last-child) .latest-version').each(function(i) {
                        var version = results[i][1];
                        $(this).text(version ? gettext('Latest version: ')+version : gettext('Module not found'));
                    });
                });
            });

            $('#dependency-option-use-cache').change(function() {
                SUGGEST_CACHED = $(this).is(':checked');
                $('#dependency-option-immediate-results').attr('disabled', !$(this).is(':checked'));
                if (!SUGGEST_CACHED) {
                    IMMEDIATE_RESULTS = false;
                    search_form._opts.suggestions = [];
                }
            });

            $('#dependency-option-immediate-results').change(function() {
                IMMEDIATE_RESULTS = $(this).is(':checked');
                search_form._opts.suggestions = IMMEDIATE_RESULTS ? cache.get_list() : [];
            });

            live_form.init();
        });
    }

    function show_dependencies_pane() {
        CloudPebble.Sidebar.SuspendActive();
        if (CloudPebble.Sidebar.Restore("dependencies")) {
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
