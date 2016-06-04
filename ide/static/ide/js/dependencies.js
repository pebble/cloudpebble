CloudPebble.Dependencies = (function() {
    var dependencies_template = null;

    // TODO: Once values for these are decided, they should be deleted and refactored out
    var SUGGEST_CACHED = true;
    var IMMEDIATE_RESULTS = false;
    var SMALLEST_FIRST = true;
    var SHOW_SPINNER = true;

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

        /** Sort comparison function for items which sorts by shortest-name-first if the scores are identical. */
        function sort_fn(a, b) {
            return (a.score === b.score) ? a.item.name.length - b.item.name.length : a.score - b.score;
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
                var options = {
                    keys: [key]
                };
                if (SMALLEST_FIRST) options.sortFn = sort_fn;
                return (new Fuse(data, options)).search(query);
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
                $(this).closest('.text-suggestion').click();
            }).mouseover(function() {
                $(this).closest('.text-suggestion').mouseover();
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
                cache: true,
                loading: {delay: 1000}
            },
            autocomplete: {
                render: render_suggestion
            },
            ext: {
                core: {
                },
                itemManager: {
                    itemToString: function(item) {
                        return item.name;
                    },
                    stringtoItem: function(string) {
                        return {name: string};
                    },
                    compareItems: function(item1, item2) {
                        if (!item1 || !item2) return 0;
                        return item1.name == item2.name;
                    },
                    itemContains: function(item, needle) {
                        return item.name.includes(needle);
                    },
                    filter: function(list, query) {
                        return dedupe_results(filter_results(list, query));
                    }
                },
                // This extension modifies textext so that it only keeps track of the selected item if you have
                // manually navigated the suggestion list.
                autocomplete: {
                    getSuggestions: function() {
                        // Just hide the suggestions of the user clears the input box.
                        var val = this.val();
                        if (!val.trim()) {
                            this._previousInputValue = val;
                            this.hideDropdown();
                        }
                        else {
                            $.fn.textext.TextExtAutocomplete.prototype.getSuggestions.apply(this, arguments);
                        }
                    },
                    onShowDropdown: function(e, renderCallback) {
                        // Re-select the first item if the user hasn't pressed the up or down keys
                        $.fn.textext.TextExtAutocomplete.prototype.onShowDropdown.apply(this, arguments);
                        if (!this.manual_control) {
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
                        // this.manual_control keeps track of whether the user pressed the up or down keys since
                        // the last time the dropdown was hidden.
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
                        // Update the package cache with the new data
                        var suggestions;
                        cache.update_modules(data);
                        spinner.addClass('hide');
                        // Sort the suggestions based on text similarity
                        if (!query) {
                            suggestions = [];
                        }
                        else if (SUGGEST_CACHED) {
                            suggestions = dedupe_results(filter_results(cache.get_list(), query));
                        }
                        else {
                            suggestions = sort_results(data, query);
                        }
                        $.fn.textext.TextExtAjax.prototype.onComplete.apply(this, [suggestions, query]);
                    },
                    load: function(query) {
                        if (SHOW_SPINNER) {
                            spinner.removeClass('hide');
                        }
                        return $.fn.textext.TextExtAjax.prototype.load.apply(this, arguments);
                    }
                }
            }
        }).textext()[0];

        var spinner = $('<img>')
            .attr('src', "/static/ide/img/spinner.gif")
            .css({position: 'absolute', right: '20px' ,top: 'calc(50% - 8px)'})
            .addClass('hide');
        textarea_element.closest(".text-wrap").append(spinner);

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
        }).init();
    }

    /** Save the dependencies and update YCM */
    function save_dependencies(values) {
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
        }).then(function() {
            return CloudPebble.YCM.updateDependencies(_.object(values));
        })
    }

    //
    // function ProgressBar(element) {
    //
    // }
    //
    // function show_if_slow(element, promise) {
    //     var showing = false;
    //     var ok_to_hide = false;
    //     var hide_timeout;
    //     var show_timeout = setTimeout(function() {
    //         element.removeClass('hide');
    //         showing = true;
    //         hide_timeout = setTimeout(function() {
    //
    //         }, 800);
    //     }, 2000);
    //
    //     return promise.finally(function() {
    //         clearTimeout(timeout);
    //         if (showing) {
    //
    //         }
    //     })
    // }

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
            return save_dependencies(kv_table.getValues())
        }

        // setTimeout is required due to a limitation/bug in the textext library.
        setTimeout(function() {
            var live_form = make_live_settings_form({
                save_function: save_form,
                on_save: hide_error,
                error_function: display_error,
                on_progress_started: function() {
                    pane.find('.dependencies-progress').removeClass('hide');
                },
                on_progress_complete: function() {
                    pane.find('.dependencies-progress').addClass('hide');
                },
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

            setup_search_test_options(pane, search_form);

            live_form.init();
        });
    }

    /** This sets up the hidden search options pane. */
    function setup_search_test_options(pane, search_form) {
        pane.find('#dependency-option-use-cache').change(function() {
            SUGGEST_CACHED = $(this).is(':checked');
            $('#dependency-option-immediate-results').attr('disabled', !$(this).is(':checked'));
            if (!SUGGEST_CACHED) {
                IMMEDIATE_RESULTS = false;
                search_form._opts.suggestions = [];
            }
        });

        pane.find('#dependency-option-immediate-results').change(function() {
            IMMEDIATE_RESULTS = $(this).is(':checked');
            search_form._opts.suggestions = IMMEDIATE_RESULTS ? cache.get_list() : [];
        });

        pane.find('#dependency-option-smallest-first').change(function() {
            SMALLEST_FIRST = $(this).is(':checked');
        });

        pane.find('#dependency-option-show-spinner').change(function() {
            SHOW_SPINNER = $(this).is(':checked');
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
