CloudPebble.TestManager = (function() {
    var ui, api;

    function API(project_id) {
        var base_url = '/ide/project/'+project_id+'/';
        var noop = function(x) {return x};
        /**
         * A store keeps track of some state which is fetched from the server. Any time this state is changed,
         * it fires a 'changed' event.
         */
        var Store = _.extend({
            state: {},
            /** default URL to send GET requests to**/
            url: '',
            /** name of key to use when returning from getState() **/
            key: 'data',
            /** name of key in the resulting request to fetch data from**/
            server_key: 'data', /**
             * This function should return true for any object which we would expect to be sent in a GET request
             * @param options The options for the GET request.
             * @returns {Function} by default, returns a function which always returns True, since the default behaviour
             * of 'refresh' is to fetch all items.
             */
            filter_function: function(options) {
                return function() { return !!options };
            },
            /**
             * Given the result of a request, a function which should filter out any objects which might be deleted,
             * update the state of the store and send a 'changed' event.
             * @param result an object with a single key containing an array of data.
             * @param options e.g. options to pass to the filter function
             */
            syncData: function(result, options) {
                var filter_function = this.filter_function(options);
                var data = result[this.server_key];
                if (!_.isArray(data)) {data = [data];}
                this.state = _.pick(this.state, filter_function);
                _.extend(this.state, _.indexBy(data, 'id'));
                this.trigger('changed', this.getState());
            },
            reportError: function(jqXHR, textStatus, errorThrown) {
                if (textStatus !== 'abort') {
                    this.trigger('error', {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown, errorFor: this.name});
                }
            },
            /**
             * Send a GET request to refresh the store.
             * @param options GET parameters.
             */
            refresh: function(options) {
                var url = base_url + this.url;
                var query = {};
                options = (_.isNumber(options) ? {id: options} : (options));
                if (_.isEqual(_.keys(options), ['id'])) {
                    url += '/' + options.id;
                }
                else {
                    query = options;
                }
                return $.ajax(url, {
                    data: query
                }).done(function(result) {
                    this.syncData(result, options);
                }.bind(this)).fail(this.reportError.bind(this));
            },
            /**
             * The ordering function should sort the store's data.
             */
            ordering: noop,
            /**
             * Convert this object's state dictionary to a sorted data array.
             * @returns {{string: Array}} object with a single K:V pair containing the sorted data list
             */
            getState: function() {
                var state = {};
                state[this.key] = this.ordering(_.map(this.state, noop));
                return state;
            },
            initial: function() {
                return this.getState();
            }
        }, Backbone.Events);

        /**
         * The TestStore downloads a list of TestFile objects from the server
         * @constructor
         */
        function TestsStore() {
            _.extend(this, Store);
            this.url = 'tests';
            this.server_key = 'tests';
            this.key = 'tests';
            this.name = "Tests";
        }

        /**
         * The SessionStore downloads all of the TestSession objects from the server
         * @constructor
         */
        function SessionsStore() {
            _.extend(this, Store);
            this.url = 'test_sessions';
            this.key = 'sessions';
            this.name = "Sessions";
            /**
             * Post a new test session, running all of the tests in the project.
             */
            this.new = function () {
                return $.ajax(base_url + 'test_sessions/run', {
                    method: 'POST'
                }).done(function (result) {
                    var session = {data: [result.data]};
                    this.syncData(session, noop);
                }.bind(this));
            };
            /**
             * Sorts sessions by date
             */
            this.ordering = function(sessions) {
                return _.sortBy(sessions, function(session) {
                    return -(new Date(session.date_added));
                });
            };
        }

        function LogsStore() {
            _.extend(this, Store);
            this.url = 'test_logs';
            this.key = 'logs';
            this.state = {};
            this.refresh = function(id) {
                var self = this;
                var url = base_url+this.url+'/'+id;
                return $.ajax(url).then(function(data) {
                    self.state[id] = {text: data, id: id};
                    self.trigger('changed', self.getState());
                }, function(failure) {

                });
            };
            this.subscribe = function(id, session_id, url) {
                var self = this;
                var evtSource = new EventSource(url);
                var done = false;
                self.state[id] = {text: '', id: id};

                var onClose = function() {
                    if (!done) {
                        done = true;
                        setTimeout(function () {
                            Runs.refresh({id: id});
                            Tests.refresh();
                            Sessions.refresh({id: session_id});
                        }, 1000);
                    }
                };
                evtSource.addEventListener('log', function(e) {
                    self.state[id].text += e.data+'\n';
                    self.trigger('changed', self.getState());
                });
                evtSource.addEventListener('done', function(e) {
                    evtSource.close();
                    onClose();
                });
                evtSource.onerror = function() {
                    onClose();
                }
            }
        }

        /**
         * The RunsStore keeps track of TestRun objects.
         * @constructor
         */
        function RunsStore() {
            _.extend(this, Store);
            this.url = 'test_runs';
            this.key = 'runs';
            this.name = "Runs";
            this.logs = {};
            /**
             * Filters out runs with selected IDs or sessions, before fetching them again
             */
            this.filter_function = function(options) {
                return function(run) {
                    if (!options) {
                        return false;
                    }
                    return !(_.isUndefined(run) ||
                    (options.test && run.test && run.test.id == options.test) ||
                    (options.session && run.session_id == options.session));
                }
            };
            /**
             * Sorts test runs by name and date
             */
            this.ordering = function(runs) {
                return _.sortBy(_.sortBy(runs, 'name'), function(run) {
                    return -(new Date(run.date_added));
                });
            };
        }

        /**
         * An object to manage navigation within the React app.
         * It deals with cancelling navigation requests if new requests are made, and navigates to 'error' pages
         * if any requests fail. It can delay navigation until a request is finished, but then skip the wait if the
         * page has been previously navigated to.
         * @constructor
         */
        function RouteStore() {
            _.extend(this, Backbone.Events);
            var page_already_fetched = {};
            var currently_waiting_for = null;
            var route = [];
            var history = [[]];

            /** make a key from a page/id pair */
            var key = function(page, id) {
                return page+':'+id;
            };
            /** split a page:id key */
            var from_key = function(key) {
                var split = key.split(':');
                var ret = {page: split[0]};
                if (split[1]) {
                    ret['id'] = parseInt(split[1], 10);
                }
                return ret;
            };

            /** Check if a page/id has been loaded before */
            this.isCached = function(page, id) {
                return !!page_already_fetched[key(page, id)];
            };

            /** Record that a page/id has been loaded before */
            var setCached = function(page, id) {
                page_already_fetched[key(page, id)] = true;
            };

            /** Set the current request to (a promise object) and cancel the previous one. */
            var setCurrentRequest = function(deferred) {
                if (deferred) {
                    deferred.always(function () {
                        if (currently_waiting_for == this) {
                            currently_waiting_for = null;
                        }
                    }.bind(deferred));
                }
                if (currently_waiting_for) {
                    currently_waiting_for.abort();
                }
                currently_waiting_for = deferred;
            };

            this.triggerCurrent = function() {
                this.trigger('changed', {route: route.map(from_key)});
            };

            /**
             * Instantly navigate to a page/id.
             * @param page name of the page. If is starts with a '/', navigate down one level.
             * @param id ID of object to be shown.
             */
            this.navigate = function(page, id) {
                var new_route;
                setCurrentRequest(null);
                if (page.startsWith('/')) {
                     new_route = route.concat([key(page.slice(1), id)]);
                }
                else {
                    new_route = [key(page, id)];
                }
                route = new_route;
                setCached(page, id);
                history.push(route);
                this.triggerCurrent();
            };

            /** Navigate up one level */
            this.up = function() {
                setCurrentRequest(null);
                route.pop();
                history.push(route);
                this.triggerCurrent();
            };

            /**
             * Navigate to a page/id after a promise is completed.
             * If the page has been navigated to in the past, don't bother waiting. If the request fails, navigate to
             * an error page.
             */
            this.navigateAfter = function(page, id, deferred) {
                var self = this;
                // If we've already been the page, don't actually wait for the request
                if (this.isCached(page, id) || !deferred) {
                    this.navigate(page, id);
                    setCurrentRequest(deferred);
                    return $.Deferred().resolve();
                }
                else {
                    // Otherwise, wait for it to finish. In the meantime, show a loading bar if it takes too long.
                    setCurrentRequest(deferred);
                    var timeout = setTimeout(function() {
                        self.trigger('changed', {route: [{page: 'loading'}]});
                    }.bind(this), 300);
                    return deferred
                        .done(function() {
                            // When the request finishes, remember that it's been visited and then navigate to
                            // the requested page.
                            setCached(page, id);
                            this.navigate(page, id);
                        }.bind(this))
                        .always(function() {
                            // No matter how the request ends, clear the loading-bar timeout.
                            clearTimeout(timeout);
                        });
                }

            };
            this.initial = function() {return {route: route}};
            this.refresh = noop;
        }

        var Tests = new TestsStore();
        var Sessions = new SessionsStore();
        var Route = new RouteStore();
        var Runs = new RunsStore();
        var Logs = new LogsStore();

        return {
            Tests: Tests,
            Sessions: Sessions,
            Route: Route,
            Runs: Runs,
            Logs: Logs
        }
    }

    var get_api = function() {
        return (api ? api : (api = new API(PROJECT_ID)));
    };

    var get_interface = function() {
        return (ui ? ui : (ui = CloudPebble.TestManager.Interface(get_api())));
    };


    var show_test_manager_pane = function() {
        var api = get_api();
        var ui = get_interface();
        return $.when(api.Tests.refresh()).then(function() {
            CloudPebble.Sidebar.SuspendActive();
            if (!CloudPebble.Sidebar.Restore("testmanager")) {
                ga('send', 'event', 'project', 'load testmanager');
                var pane = $('<div></div>').attr('id', '#testmanager-pane-template').toggleClass('testmanager-pane', true);
                CloudPebble.Sidebar.SetActivePane(pane, 'testmanager');
                ui.render(pane.get(0), {project_id: PROJECT_ID});
            }
            return api.Sessions.refresh();
        });
    };

    return {
        Show: function() {
            show_test_manager_pane();
        },
        ShowTest: function(test_id) {
            var api = get_api();
            return api.Runs.refresh({test: test_id}).done(function() {
                api.Route.navigate('test', test_id);
                return show_test_manager_pane();
            });
        },
        ShowLiveTestRun: function(url, session_id, run_id) {
            var api = get_api();
            api.Logs.subscribe(run_id, session_id, url);
            return api.Runs.refresh({id: run_id}).then(function() {
                return show_test_manager_pane();
            }).then(function() {
                api.Route.navigate('session', session_id);
                api.Route.navigate('/logs', run_id);
            });
        },
        Init: function() {
            var commands = {};
            commands[gettext('Test Manager')] = CloudPebble.TestManager.Show;
            CloudPebble.FuzzyPrompt.AddCommands(commands);
        }
    }
})();