CloudPebble.Dependencies = (function() {
    var dependencies_template = null;

    /**
     * Set up the package search form.
     * @param form_element A form element containing a textarea.
     * @param on_submit A callback taking arguments (name, version) called when the user selects a package.
     */
    function setup_npm_search_form(form_element, on_submit) {
        var textarea_element = form_element.find('textarea');
        var version_cache = {};
        // Configure a textext entry to autocomplete package names by searching node-modules.com

        // ajax: {crossDomain: true} is required to prevent CORS errors.
        textarea_element.textext({
            plugins: 'focus prompt ajax autocomplete',
            prompt: gettext('Search NPM...'),
            ajax: {
                url: 'http://node-modules.com/search.json',
                dataType: 'json',
                crossDomain: true
            },
            autocomplete: {
                render: function(element) {
                    // This renders suggestions as the package name in bold, followed by the description
                    var elm = $('<div></div>').addClass('package-suggestion');
                    $('<span></span>').text(element.name).addClass('package-suggestion-name').appendTo(elm);
                    $('<span></span>').text(element.description).appendTo(elm);
                    return elm[0].outerHTML;
                }
            },
            ext: {
                itemManager: {
                    itemToString: function(item) {
                        console.log(item);
                        return item.name;
                    },
                    stringtoItem: function(string) {
                        return {name: string}
                    }
                },
                ajax: {
                    onComplete: function(data, query) {
                        // This intercepts the Ajax search results callback in order to
                        // keep a cache of which modules are at which versions.
                        // When the user selects a package, we can use this cache to look up
                        // the package's version number.
                        _.extend(version_cache, _.object(_.map(data, function(o) {
                            return [o.name, o.version];
                        })));
                        $.fn.textext.TextExtAjax.prototype.onComplete.apply(this, [data, query]);
                    }
                }
            }
        });
        form_element.submit(function(e) {
            e.preventDefault();
            var textext = textarea_element.textext()[0];
            var val = JSON.parse(textext.hiddenInput().val());
            var version = version_cache[val];
            // If the package is not in the version cache, look up the package on node-modules.com
            // directly and check the version there. If it is not there either, the callback is called
            // with version = null.
            if (version) {
                on_submit(val, version);
            }
            else {
                var url = "http://node-modules.com/package/" + encodeURI(val) + ".json";
                $.ajax({
                    url: url,
                    crossDomain: true,
                    dataType: 'json'
                }).then(function(data) {
                    on_submit(val, data.version ? data.version : null);
                }).fail(function() {
                    on_submit(val, null);
                });
            }
        });
    }

    function setup_dependencies_pane(pane) {
        var npm_search_form = pane.find('#dependencies-search-form');

        setTimeout(function() {
            setup_npm_search_form(npm_search_form, function(name, version) {
                console.log("Added package", name, version);
            });
        })
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
