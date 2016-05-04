CloudPebble.TestManager = (function() {
    const POLLING_PERIOD = 10000;
    let ui, api;

    function API(project_id) {
        const base_url = `/ide/project/${project_id}/`;
        /**
         * A store keeps track of some state which is fetched from the server. Any time this state is changed,
         * it fires a 'changed' event.
         */
        const Store = _.extend({
            state: {},
            /** default URL to send GET requests to**/
            url: '',
            /** name of key to use when returning from getState() **/
            key: 'data',
            /** name of key in the resulting request to fetch data from**/
            server_key: 'data',
            ignore_refresh_options: false,

            /** Trigger a Backbone event asynchronously.
             * @param {string} event name of event
             * @param {object} data object to send
             */
            triggerLater(event, data) {
                _.defer(() => {
                    this.trigger(event, data);
                });
            },
            /**
             * This function should return true for any object which we would expect to be sent in a GET request
             * @param options The options for the GET request.
             * @returns {Function} by default, returns a function which always returns True, since the default behaviour
             * of 'refresh' is to fetch all items.
             */
            filter_function(options) {
                return () => !!options;
            },
            /**
             * Given the result of a request, a function which should filter out any objects which might be deleted,
             * update the state of the store and send a 'changed' event.
             * @param result an object with a single key containing an array of data.
             * @param options e.g. options to pass to the filter function
             */
            syncData(result, options) {
                const filter_function = this.filter_function(options);
                const data = result[this.server_key];
                let data_list = data;
                if (!_.isArray(data)) {
                    data_list = [data];
                }
                this.state = _.pick(this.state, filter_function);
                _.extend(this.state, _.indexBy(data_list, 'id'));
                this.triggerLater('changed', this.getState());
                return data;
            },
            /**
             * This function is called when the object is requested, and should
             * return any other promises which need to be resolved before the request
             * can be considered complete.
             * @param id the ID of the object for which relevant objects need to be fetched.
             * @returns {Promise}
             */
            get_extra_requests(id) {
                return Promise.resolve();
            },
            /**
             * Send a GET request to refresh the store with arbitrary parameters
             * @param options the GET parameters.
             * @returns {Promise} Ajax request
             */
            refresh(options) {
                let url = base_url + this.url;
                let query = {};
                if (this.ignore_refresh_options) {
                    options = {};
                }
                else {
                    options = _.isNumber(options) ? {id: options} : (options);
                }
                if (_.isEqual(_.keys(options), ['id'])) {
                    url += `/${options.id}`;
                }
                else {
                    query = options;
                }

                return Ajax.Ajax(url, {
                    data: query
                }).then((result) => {
                    return this.syncData(result, options);
                }).catch((error) => {
                    this.triggerLater('error', {text: error.message, errorFor: this.name});
                    throw error;
                });
            },

            /**
             * This function should return false if all data needed to display the object referenced by the ID
             * (for example, a test session and all of its test runs) are in a state which should never change
             * (e.g. none are pending).
             * @param id ID of the object to evaluate
             * @returns {boolean} True if new GET requests may return different information.
             */
            requestRequired(id) {
                return true;
            },

            /**
             * Make all the requests necessary to show an item from the sotre with a particular ID.
             * @param id ID of the object to fetch.
             * @returns {Promise} A promise composed of multiple promises/requests.
             */
            request(id) {
                if (this.requestRequired(id)) {
                    return Promise.all([
                        this.refresh(id),
                        this.get_extra_requests(id)
                    ]);
                }
                else {
                    return Promise.resolve();
                }
            },
            /**
             * The ordering function should sort the store's data.
             */
            ordering(data) {
                return data;
            },
            /**
             * Convert this object's state dictionary to a sorted data array.
             * @returns {{string: Array}} object with a single K:V pair containing the sorted data list
             */
            getState() {
                const state = {};
                state[this.key] = this.ordering(_.map(this.state, (x)=>x));
                return state;
            },
            /** Get the initial state of the store. */
            initial() {
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
            this.ignore_refresh_options = true;

            /** Update the runs for this test when we navigate to its page */
            this.get_extra_requests = (id) => Runs.refresh({test: id});
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

            /** Post a new test session, running all of the tests in the project. */
            this.new = function() {
                return Ajax.Ajax(`${base_url}test_sessions/run`, {
                    method: 'POST'
                }).then((result) => {
                    result.session.is_new = true;
                    this.syncData({data: [result.session]}, {});
                    Tests.refresh();
                });
            };

            /** Ensure that we don't send useless requests for completed test sessions */
            this.requestRequired = function(id) {
                const session = _.find(this.state, {id: id});
                if (!session) return true;
                // If we have not fetched all runs for this session
                const got_all_runs = (_.filter(Runs.state, {session_id: id}).length == session.run_count);
                // or the session is still pending
                const is_pending = (session.status == 0);
                // then we need to send new GET requests for it.
                return is_pending || !got_all_runs;
            };

            /** Update the runs for this session when we navigate to its page */
            this.get_extra_requests = (id) => Runs.refresh({session: id});

            /** Sorts sessions by date */
            this.ordering = function(sessions) {
                return _.sortBy(sessions, session => -(new Date(session.date_added)));
            }
        }

        function LogsStore() {
            _.extend(this, Store);
            this.url = 'test_logs';
            this.key = 'logs';
            this.name = 'Logs';
            this.state = {};
            this.subscriptions = {};

            /** A request is required if this or RunStore do not have information on the run, or if there is an active
             * live log subscription for the run, or if its state is PENDING.
             */
            this.requestRequired = function(id) {
                const run = _.find(Runs.state, {id: id});
                return (!run || !this.state[id] || run.code == 0 || this.subscriptions[id]);
            };

            this.refresh = function(id) {
                const self = this;
                const url = `${base_url}${this.url}/${id}`;

                return Runs.refresh({id: id}).then((run)=> {
                    if (run.code == 0) {
                        if (!this.subscriptions[id] && run.subscribe_url) {
                            return this.subscribe(run.id, run.session_id, run.subscribe_url);
                        }
                    }
                    else {
                        return Ajax.Ajax(url).then((data)=> {
                            self.state[id] = {text: data, id};
                            self.triggerLater('changed', self.getState());
                        });
                    }
                });
            };
            this.subscribe = function(id, session_id, url) {
                if (this.subscriptions[id]) return true;
                return new Promise((resolve, reject) => {
                    const evtSource = new EventSource(url);
                    let done = false;
                    this.state[id] = {text: '', id};

                    const onClose = () => {
                        delete this.subscriptions[id];
                        if (!done) {
                            done = true;
                            setTimeout(() => {
                                Runs.refresh({id});
                                Tests.refresh();
                                Sessions.refresh({id: session_id});
                            }, 1000);
                        }
                    };
                    evtSource.addEventListener('log', (e) => {
                        this.state[id].text += `${e.data}\n`;
                        this.triggerLater('changed', this.getState());
                    });
                    evtSource.addEventListener('done', () => {
                        evtSource.close();
                        onClose();
                    });
                    evtSource.onopen = () => {
                        this.subscriptions[id] = true;
                        resolve();
                    };
                    evtSource.onerror = () => {
                        onClose();
                        reject();
                    };
                });
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

            this.requestRequired = function(id) {
                const run = Runs.find({id: id});
                return (!run || run.code == 0);
            };

            /**
             * Filters out runs with selected IDs or sessions, before fetching them again
             */
            this.filter_function = (options) => (run) => {
                if (!options) {
                    return false;
                }
                return !(_.isUndefined(run) ||
                (options.test && run.test && run.test.id == options.test) ||
                (options.session && run.session_id == options.session));
            };
            /**  Sorts test runs by name and date */
            this.ordering = function(runs) {
                return _.chain(runs).sortBy('name').sortBy((run) => -(new Date(run.date_added))).value();
            }
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
            const page_already_fetched = {};
            let currently_waiting_for = null;
            let route = [];
            let interval = null;
            let polling_request = null;
            let default_request_function = () => Promise.resolve();
            const routes_to_stores = {};

            /** make a key from a page/id pair */
            const key = (page, id) => `${page}:${id}`;
            /** split a page:id key */
            const from_key = (key) => {
                if (!key) return null;
                const split = key.split(':');
                const ret = {page: split[0]};
                if (split[1]) {
                    ret['id'] = parseInt(split[1], 10);
                }
                return ret;
            };

            /** Record that a page/id has been loaded before */
            function setCached(page, id) {
                page_already_fetched[key(page, id)] = true;
            }

            /** Set the current request to (a promise object) and cancel the previous one. */
            function setCurrentRequest(page, id) {
                currently_waiting_for = [page, id];
            }

            /** Check if the current request is for a particular page/id combo */
            function isCurrentRequest(page, id) {
                return _.isEqual(currently_waiting_for, [page, id]);
            }

            /** Find the store corresponding to the current page, and ask it to request data for a particular
             * object ID. */
            function requestPage(page, id) {
                const store = routes_to_stores[page.split('/').pop()];
                if (store) {
                    return store.request(id);
                }
            }

            /** Get the current route as a list of objects */
            this.getRoute = function() {
                return {route: route.map(from_key)}
            };

            /** Emit an event signifying a change to a new route */
            this.triggerCurrent = function() {
                _.defer(() => {this.trigger('changed', this.getRoute());});
            };

            /** Check if a page/id has been loaded before */
            this.isCached = function(page, id) {
                return !!page_already_fetched[key(page, id)];
            };

            this.setDefaultRequest = function(requestor) {
                default_request_function = requestor;
            };

            /**
             * Instantly navigate to a page/id.
             * @param page name of the page. If is starts with a '/', navigate down one level.
             * @param id ID of object to be shown.
             */
            this.switchPage = function(page, id) {
                let new_route;
                setCurrentRequest(null);
                if (page.startsWith('/')) {
                    new_route = route.concat([key(page.slice(1), id)]);
                }
                else {
                    new_route = [key(page, id)];
                }
                route = new_route;
                setCached(page, id);
                this.triggerCurrent();
            };

            /** Navigate up one level */
            this.up = function() {
                setCurrentRequest(null);
                route.pop();
                return this.poll().then(()=>this.triggerCurrent());
            };

            /**
             * Navigate to a page/id after a promise is completed.
             * If the page has been navigated to in the past, don't bother waiting. If the request fails, navigate to
             * an error page.
             * @param page Page name
             * @param id Page item ID
             * @returns {*}
             */
            this.navigate = function(page, id) {
                const promise = requestPage(page, id);
                // If we've already been the page, don't actually wait for the request
                if (this.isCached(page, id) || !promise) {
                    this.switchPage(page, id);
                    return Promise.resolve();
                }
                else {
                    // Otherwise, wait for it to finish. In the meantime, show a loading bar if it takes too long.
                    setCurrentRequest(page, id);
                    const timeout = setTimeout(() => {
                        this.trigger('changed', {route: [{page: 'loading'}]});
                    }, 300);
                    return promise.then(() => {
                        // When the request finishes, remember that it's been visited and then navigate to
                        // the requested page.
                        setCached(page, id);
                        if (isCurrentRequest(page, id)) {
                            this.switchPage(page, id);
                        }
                        // If the current request doesn't match this one, then this request is abandoned.
                    }).finally(() => {
                        // No matter how the request ends, clear the loading-bar timeout.
                        clearTimeout(timeout);
                    });
                }

            };

            this.poll = function() {
                const full_route = this.getRoute().route;
                let request;
                if (full_route.length > 0) {
                    // If we're in a sub-page, get the data which that page needs
                    const page = full_route[full_route.length - 1].page;
                    const id = full_route[full_route.length - 1].id;
                    request = requestPage(page, id);
                }
                else {
                    // Otherwise fetch whatever is needed for the dashboard.
                    request = default_request_function();
                }
                polling_request = request;
                request.finally(()=> {polling_request = null});
                return request;
            };

            this.resumePolling = function() {
                if (interval || polling_request) return;
                interval = setInterval(() => {
                    this.poll();
                }, POLLING_PERIOD);
            };

            this.pausePolling = function() {
                if (!interval) return;
                clearInterval(interval);
                interval = null;
            };

            this.registerRoutes = function(routes) {
                _.each(routes, (store) => {
                    routes_to_stores[store.key] = store;
                });
            };

            this.initial = function() {
                return this.getRoute()
            };

            /** There is no concept of refresh for the store. */
            this.refresh = ()=> {};
        }

        var Tests = new TestsStore();
        var Sessions = new SessionsStore();
        var Runs = new RunsStore();
        var Logs = new LogsStore();
        var Route = new RouteStore();
        Route.registerRoutes([Tests, Sessions, Runs, Logs]);
        Route.setDefaultRequest(()=>Promise.all([Tests.refresh(), Sessions.refresh()]));

        return {Tests, Sessions, Route, Runs, Logs}
    }

    function get_api() {
        return api ? api : (api = new API(PROJECT_ID));
    }

    function get_interface() {
        return ui ? ui : (ui = CloudPebble.TestManager.Interface(get_api()));
    }

    function show_test_manager_pane() {
        const api = get_api();
        const ui = get_interface();
        return api.Route.poll().then(() => {
            CloudPebble.Sidebar.SuspendActive();
            if (!CloudPebble.Sidebar.Restore("testmanager")) {
                ga('send', 'event', 'project', 'load testmanager');
                const pane = $('<div></div>').attr('id', '#testmanager-pane-template').toggleClass('testmanager-pane', true);
                CloudPebble.Sidebar.SetActivePane(pane, {
                    id: 'testmanager',
                    onSuspend: ()=>api.Route.pausePolling(),
                    onRestore: ()=>api.Route.resumePolling()
                });
                ui.render(pane.get(0), {project_id: PROJECT_ID});
                api.Route.resumePolling();
            }
        });
    }

    return {
        Show() {
            show_test_manager_pane();
        },
        ShowTest(test_id) {
            const api = get_api();
            return api.Route.navigate('tests', test_id).then(show_test_manager_pane);
        },
        ShowLiveTestRun(url, session_id, run_id) {
            const api = get_api();
            api.Logs.subscribe(run_id, session_id, url);
            return api.Route.navigate('sessions', session_id)
                .then(() => api.Route.navigate('/logs', run_id))
                .then(show_test_manager_pane);
        },
        Init() {
            const commands = {[gettext('Test Manager')]: CloudPebble.TestManager.Show};
            CloudPebble.FuzzyPrompt.AddCommands(commands);
        }
    }
})();