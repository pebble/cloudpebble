CloudPebble.Dependencies = (function() {
    var dependencies_template = null;
    var kv_table;
    var cloudpebble_dependencies_form;
    var headers = [];

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
            return Ajax.Get("/ide/packages/info", {q: name}).then(function(result) {
                this.update_modules([result['package']]);
                return result['package'];
            }.bind(this));
        }
    };

    /** Look up a module on node-modules or from the cache
     *
     * @param query Search query string
     * @returns {Promise} A promise which resolves with the module details if it exists.
     */
    ModuleCache.prototype.search_modules = function(query) {
        var cached = this.cache[query];
        if (cached) {
            return Promise.resolve(cached);
        }
        else {
            return Ajax.Get("/ide/packages/search", {q: query}).then(function(result) {
                this.update_modules(result['packages']);
                return result['packages'];
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
        var textext = textarea_element.textext({
            plugins: 'focus prompt autocomplete suggestions ajax',
            prompt: gettext('Search NPM...'),
            suggestions: [],
            ajax: {
                url: '/ide/packages/search',
                dataType: 'json',
                cache: true,
                loading: {delay: 1000}
            },
            autocomplete: {
                render: render_suggestion
            },
            ext: {
                core: {},
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
                        var suggestions;

                        // Hide the search box loading spinner
                        spinner.addClass('hide');

                        // Update the package cache with the new data
                        cache.update_modules(data['packages']);

                        // Sort the suggestions based on text similarity
                        if (!query) {
                            suggestions = [];
                        }
                        else if (SUGGEST_CACHED) {
                            suggestions = dedupe_results(filter_results(cache.get_list(), query));
                        }
                        else {
                            suggestions = sort_results(data['packages'], query);
                        }
                        $.fn.textext.TextExtAjax.prototype.onComplete.apply(this, [suggestions, query]);
                    },
                    load: function(query) {
                        // Show the spinner when the search box starts a request
                        if (SHOW_SPINNER) {
                            spinner.removeClass('hide');
                        }
                        return $.fn.textext.TextExtAjax.prototype.load.apply(this, arguments);
                    }
                }
            }
        }).textext()[0];

        var spinner = $('<div>')
            .css({top: 'calc(50% - 8px)'})
            .addClass('hide spinner spinner-light');
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
            // When the user submits the form, enter the package into the table.
            // If we have the package's version number cached or we can fetch it, then add that too.
            e.preventDefault();
            var val = textext.input().val().trim();
            if (!val) return;
            cache.lookup_module(val).then(function(data) {
                on_submit(val, data.version ? version_prefix + data.version : null);
                return null;
            }).catch(function() {
                on_submit(val, null);
            });
        });

        return textext;
    }

    /** Set up the dependencies KVTable so that it links to the live form system. */
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

    function select_element(element) {
        var range, selection;
        if (document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(element);
            range.select();
        } else if (window.getSelection) {
            selection = window.getSelection();
            range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }


    function render_header(name) {
        return $('<div class="dependencies-header">').append($('<a href="#">').append([
            $('<span>').text('#include <'),
            $('<span class="dependencies-header-name">').text(name),
            $('<span>').text('>')
        ]));
    }

    function update_header_list_ui(library_data) {
        var pane = $('#dependencies-headers');
        if (_.size(library_data) == 0) {
            pane.addClass('hide');
        }
        else {
            var libraries = _.chain(library_data).map(function(library, name) {
                library.name = name
                return library;
            }).sortBy('name').map(function(library) {
                return $('<tr>')
                    .append($('<td>').text(library.name))
                    .append($('<td>').text(library.version))
                    .append($('<td>').append(_.map(library.headers, render_header)));
            }).value();
            pane.removeClass('hide');
            pane.find('tbody').empty().append(libraries);
        }
    }

    function update_header_file_list(library_data) {
        headers = _.flatten(_.pluck(library_data, 'headers'));
    }

    function update_header_list(library_data) {
        update_header_list_ui(library_data);
        update_header_file_list(library_data);
    }

    /** Save the dependencies and update YCM */
    function save_dependencies(npm_values, interdependencies) {
        var dependencies = {};
        // Don't save yet if there are any incomplete values
        if (_.some(_.flatten(npm_values), function(x) {
                return !x.trim()
            })) {
            return {incomplete: true};
        }
        // Error if there are duplicate keys
        _.each(npm_values, function(tuple) {
            if (_.has(dependencies, tuple[0])) {
                throw new Error(gettext('Duplicate dependencies'));
            }
            dependencies[tuple[0]] = tuple[1];
        });
        interdependencies = _.map(interdependencies, _.partial(parseInt, _, 10));
        return Ajax.Post('/ide/project/' + PROJECT_ID + '/save_dependencies', {
            'dependencies': JSON.stringify(dependencies),
            'interdependencies': JSON.stringify(interdependencies)
        }).then(function(result) {
            CloudPebble.ProjectInfo.interdependencies = interdependencies;
            return CloudPebble.YCM.updateDependencies(result.dependencies);
        }).then(function(result) {
            if (result) {
                update_header_list(result.data.libraries)
            }
        });
    }

    function get_projects() {
        return Ajax.Get('/ide/projects', {libraries: PROJECT_ID}).then(function(data) {
            return data.projects.sort(function(a, b) {
                // Sort by (a) whether it's built, (b) alphabetically
                var a_d = a.latest_successful_build;
                var b_d = b.latest_successful_build;
                if (!!a_d != !!b_d) {
                    return !!a_d ? -1 : 1;
                }
                return (a.package_name > b.package_name)

            });
        });
    }

    function render_cloudpebble_dependency(project) {
        var date_text = !!project.latest_successful_build ? CloudPebble.Utils.FormatDatetime(project.latest_successful_build) : gettext("Never");
        return $('<tr>').append([
            $('<td>').append($('<input type="checkbox">')
                .prop('checked', project.depended_on)
                .prop('disabled', !project.latest_successful_build)
                .attr('name', project.id)),
            $('<td>').text(project.package_name),
            $('<td>').text(project.app_version_label),
            $('<td>').text(date_text),
            $('<td><span></span></td>')
        ]);
    }

    function make_live_form(options) {
        return make_live_settings_form(_.extend({
            save_function: save_forms,
            on_save: alerts.hide_error,
            error_function: alerts.show_error,
            on_progress_started: alerts.show_progress,
            on_progress_complete: alerts.hide_progress,
            group_selector: 'tr'
        }, options))
    }

    /** Set up the interdependencies UI. */
    function setup_cloudpebble_dependencies_table(pane) {
        var table = pane.find('table');
        var table_body = table.find('tbody');
        var no_packages = pane.find('#cloudpebble-dependencies-no-packages');
        var refresh_btn = pane.find('#cloudpebble-dependencies-refresh');
        cloudpebble_dependencies_form = pane.find('form');
        var live_form = make_live_form({
            form: cloudpebble_dependencies_form,
            label_selector: 'td:last-child span'
        });
        live_form.init();
        function refresh() {
            return get_projects().then(function(projects) {
                if (projects.length > 0) {
                    table.removeClass('hide');
                    no_packages.addClass('hide');
                    table_body.empty();
                    table_body.append(_.map(projects, function(project) {
                        var element = render_cloudpebble_dependency(project);
                        live_form.addElement(element);
                        return element;
                    }));
                }
                else {
                    table.addClass('hide');
                    no_packages.removeClass('hide');
                }
            });
        }
        refresh_btn.click(function() {
            refresh_btn.prop('disabled', true);
            refresh().finally(function() {
                refresh_btn.prop('disabled', false);
            })
        }).popover({
            trigger: "hover",
            html: true,
            placement: 'right',
            animation: false,
            delay: {show: 250},
            container: 'body'
        });
        refresh();
    }

    /** Set up function for the entire pane */
    function setup_npm_dependencies_pane(pane) {
        var npm_search_form = pane.find('#dependencies-search-form');
        var dependencies_table = pane.find('#dependencies-table');

        cache.search_modules('pebble-package');

        // setTimeout is required due to a limitation/bug in the textext library.
        setTimeout(function() {
            var live_form = make_live_form({
                form: pane.find('#dependencies-form'),
                label_selector: 'tr button',
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

    /** This singleton manages the error box and loading indicator. */
    var alerts = new (function Alerts() {
        var pane;
        this.show_error = function show_error(error) {
            pane.find('.alert-error').removeClass('hide').text(error);
        };
        this.hide_error = function hide_error() {
            pane.find('.alert-error').addClass('hide');
        };
        this.show_progress = function show_progress() {
            $('#sidebar-pane-dependencies .spinner').removeClass('hide');
        };
        this.hide_progress = function hide_progress() {
            $('#sidebar-pane-dependencies .spinner').addClass('hide');
        };
        this.init = function(set_pane) {
            pane = set_pane;
        }
    });


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

    /** This sets up the list of headers */
    function setup_headers_pane(pane, alerts) {
        // Select an entire header when it is clicked.
        pane.on('click', 'tbody a', function() {
            select_element(this);
        });
        // The headers refresh button is a lie since really it just saves the dependencies forms when you click it.
        // However, this has the effect of updating the autocompletions/headers if any of the libraries have changed (e.g. after a new version is published/compiled).
        pane.find('#dependencies-refresh').click(function() {
            make_live_form().save();
        }).popover({
            trigger: "hover",
            html: true,
            placement: 'right',
            animation: false,
            delay: {show: 250},
            container: 'body'
        });
        // If YCM is already initialised or in the process of initialising, this will just resolve with the initialisation promise's data.
        CloudPebble.YCM.initialise().then(function(data) {
            if (data.npm_error) {
                alerts.show_error(data.npm_error);
            }
            else {
                update_header_list(data.libraries);
            }
        });

    }

    /** Save both dependency forms */
    function save_forms() {
        return save_dependencies(kv_table.getValues(), _.pluck(cloudpebble_dependencies_form.serializeArray(), 'name'))
    }

    /** Set up all UI elements */
    function setup_dependencies_pane(pane) {
        setup_npm_dependencies_pane(dependencies_template);
        setup_cloudpebble_dependencies_table(dependencies_template.find('#cloudpebble-dependencies'));
        setup_headers_pane(pane.find('#dependencies-headers'));
    }

    function show_dependencies_pane() {
        CloudPebble.Sidebar.SuspendActive();
        if (CloudPebble.Sidebar.Restore("dependencies")) {
            return;
        }
        ga('send', 'event', 'project', 'load dependencies');
        setup_dependencies_pane(dependencies_template);
        CloudPebble.Sidebar.SetActivePane(dependencies_template, {id: 'dependencies'});
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
            alerts.init(dependencies_template);

            alerts.show_progress();
            CloudPebble.YCM.initialise().then(function(data) {
                if (data.libraries) {
                    update_header_file_list(data.libraries)
                }
            }).finally(function() {
                alerts.hide_progress();
            });
        },
        GetHeaderFileNames: function() {
            return headers;
        }
    };
})();
