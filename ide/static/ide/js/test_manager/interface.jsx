CloudPebble.TestManager.Interface = (function(API) {
    var CODES = {
        '-2': gettext('error'),
        '-1': gettext('failed'),
        '0' : gettext('pending'),
        '1' : gettext('passed')
    };

    var {Route, Sessions, Tests, Runs} = API;

    /**
     * The Pagination object is a mixin providing most of the functions needed to support and
     * render a pagination switcher.
     * Classes which use Pagination should define this.pageSize and have a 'getLength()' function.
     */
    var Pagination = {
        /**
         * Given a number of pages and current page, generate Pagination indexes
         * @param page
         * @param pageMax
         * @param minimum_bounds the guaranteed number of items to show at each end
         * @param dot_coverage the minimum number of dots to represent with a '...'
         * @param delta the number of items to show on each side of the current page
         * @returns {Array.<T>} an array of numbers and one or two '...' strings
         */
        calculatePaging: function(page, pageMax, delta=2, minimum_bounds=1, dot_coverage=2) {
            if (pageMax == 1) return [1];
            // 'left' and 'right' represent the indices of the pages to show around the current page.
            var left = page-delta;
            var right = page+delta;
            // If they are close enough to first or last pages, shift them
            if (left <= minimum_bounds + dot_coverage ) {
                left -= (dot_coverage - 1);
            }
            if (right >= pageMax - minimum_bounds - dot_coverage + 1) {
                right += (dot_coverage - 1);
            }
            // Ensure that 'left'/'right' don't cross into the boundary pages
            left = Math.max(left, minimum_bounds+1);
            right = Math.min(right, pageMax-minimum_bounds);
            // Build the list of pages to show
            var range = _.range(1, minimum_bounds+1).concat(_.range(left, right+1), _.range(pageMax-minimum_bounds+1, pageMax+1));
            // Add '...'s to fill in the gaps, if necessary
            if (left > dot_coverage + minimum_bounds) range.splice(minimum_bounds, 0, '...l');
            if (right < pageMax - minimum_bounds - dot_coverage + 1) range.splice(range.length-(minimum_bounds), 0, '...r');
            return range;
        },
        getInitialState: function() {
            return {
                page: 0
            }
        },
        gotoPage: function(n) {this.setState({page: Math.max(0, Math.min( this.maxPages(), n))});},
        maxPages: function() {return Math.floor((this.getLength()-1)/this.pageSize);},
        page: function(arr) {return arr.slice(this.state.page*this.pageSize, (this.state.page+1)*this.pageSize);},
        renderButton: function(num) {
            return (_.isString(num)
                ? <button key={num} className="btn" disabled="disabled">...</button>
                : <button key={num} className="btn" onClick={()=>this.gotoPage(num-1)}>{num}</button>
            );
        },
        renderPager: function() {
            var page = this.state.page;
            var pageMax = this.maxPages();
            if (pageMax <= 0) return null;
            var indices = this.calculatePaging(page+1, pageMax+1);
            return (
                <div className="paginator">
                    {indices.map(this.renderButton)}
                </div>
            );
        }
    };

    /**
     * Renders a <div> with class='well'.
     */
    function Well(props) {
        var {className, children, ...other} = props;
        return <div className={(className || '')+' well'} {...other}>{children}</div>;
    }

    /**
     * The 'Anchor' class is an <a> tag which automatically preventDefaults clicks.
     */
    function Anchor(props) {
        var {onClick, children, ...other} = props;
        var clicked = function(event) {
            onClick();
            event.preventDefault();
            return false;
        };
        return (<a href='' {...other} onClick={clicked}>{children}</a>);
    }

    /**
     * Renders a <td> with the colour/content sent to represent a test result
     */
    function TestResultCell(props) {
        var result_name = CODES[props.code];
        var classes = "test-run test-"+result_name;
        return (<td className={classes}>{result_name}</td>);
    }

    /**
     * TestList allows navigation between each individual tests
     */
    function TestList(props) {
        var tests = props.tests.map(function(test) {
            var onClick = function() {Route.navigateAfter('test', test.id, Runs.refresh({test: test.id}), true);};
            var className = "clickable"+(props.selected == test.id ? ' selected' : '');
            return (
                <tr key={test.id} onClick={onClick} className={className}>
                    <td><Anchor scrollTo="#testmanager-test" onClick={onClick}>{test.name}</Anchor></td>
                    <TestResultCell code={test.last_code} />
                </tr>
            );
        });
        return (
            <table>
                <thead><tr>
                    <th>{gettext('Name')}</th>
                    <th>{gettext('Last Status')}</th>
                </tr></thead>
                <tbody>{tests}</tbody>
            </table>
        );
    }

    /**
     * RunList shows a list of test runs, e.g. for a single test or session
     */
    var RunList = React.createClass({
        mixins: [Pagination],
        pageSize: 18,
        getLength: function() {
            return _.keys(this.props.runs).length;
        },
        renderRow: function(run) {
            var datestring = (new Date(run.date_added)).toUTCString();
            // TODO: nicer logs button
            var show_logs = function() {
                Route.navigateAfter('/logs', run.id, Runs.fetchLogs(run.id));
            };
            return (
                <tr key={run.id} className="clickable" onClick={show_logs}>
                    {this.props.test ? null : <td>{run.name}</td>}
                    {this.props.session ? null : <td>{datestring}</td>}
                    <TestResultCell code={run.code} />
                    <td>{(!run.logs ? '':
                        <Anchor href={run.logs} target='_blank' onClick={show_logs}>{gettext('Show logs')}</Anchor>
                        )}
                    </td>
                </tr>
            );
        },
        render: function() {
            var {runs, test, session} = this.props;
            var paged = this.page(runs);
            if (_.keys(paged).length == 0) {
                return (<p>{gettext('Nothing to show')}</p>);
            }
            var children = _.map(paged, this.renderRow);
            return (
                <div>
                    <table>
                        <thead><tr>
                            {test ? null : <th>{gettext('Name')}</th>}
                            {session ? null : <th>{gettext('Date')}</th>}
                            <th>{gettext('Status')}</th>
                            <th>{gettext('Logs')}</th>
                        </tr></thead>
                        <tbody>{children}</tbody>
                    </table>
                    {this.renderPager()}
                </div>
            )
        }
    });

    /**
     * SessionList allows navigation through every test job.
     */
    var SessionList = React.createClass({
        mixins: [Pagination],
        pageSize: 10,
        getLength: function() {
            return this.props.sessions.length;
        },
        onClickSession: function(session) {
            Route.navigateAfter('session', session.id, Runs.refresh({session: session.id}), true);
            Sessions.refresh({id: session.id});
        },
        renderRow: function(session) {
            var datestring = (new Date(session.date_added)).toUTCString();
            var className = 'pending';
            if (session.fails > 0) {
                className = 'failed';
            }
            else if (session.passes == session.run_count) {
                className = 'passed';
            }
            var passesClassName = 'test-'+className;
            var rowClassName = "clickable"+(this.props.selected == session.id ? ' selected' : '');
            return (
                <tr className={rowClassName} key={session.id} onClick={()=>this.onClickSession(session)}>
                    <td><Anchor onClick={()=>this.onClickSession(session)}>{datestring}</Anchor></td>
                    <td className={passesClassName}>{interpolate("%s/%s", [session.passes, session.run_count])}</td>
                </tr>
            )
        },
        render: function() {
            var sessions = this.page(this.props.sessions.map(this.renderRow));
            return (
                <div>
                    <table>
                        <thead><tr>
                            <th>{gettext('Date')}</th>
                            <th>{gettext('Passes')}</th>
                        </tr></thead>
                        <tbody>{sessions}</tbody>
                    </table>
                    {this.renderPager()}
                </div>);
        }
    });

    /**
     * SingleSession shows the info for a particular testing job, and all the tests run for it.
     */
    function SingleSession(props) {
        var filtered = _.filter(props.runs, (run) => run.session_id == props.id);
        var datestring = (new Date(props.date_added)).toUTCString();
        return (
            <div>
                <table>
                    <tbody>
                    <tr><th>{gettext('Job')}</th><td>{props.id}</td></tr>
                    <tr><th>{gettext('Passes')}</th><td>{(_.countBy(filtered, 'code')[1] || 0)+'/'+filtered.length}</td></tr>
                    <tr><th>{gettext('Date')}</th><td>{datestring}</td></tr>
                    </tbody>
                </table>
                <RunList runs={filtered} session={props} />
            </div>
        );
    }

    /**
     * SingleTest shows the details for a single test, and all times it has been run
     */
    function SingleTest(props) {
        var filtered = _.filter(props.runs, (run) => (!_.isUndefined(run.test) && run.test.id == props.id));
        return (
            <div id="testmanager-test">
                <table>
                    <tbody>
                    <tr><th>{gettext('Test')}</th><td>{props.name}</td></tr>
                    <tr><th>{gettext('Passes')}</th><td>{(_.countBy(filtered, 'code')[1] || 0) + '/' + filtered.length}</td></tr>
                    </tbody>
                </table>
                <RunList runs={filtered} test={props}/>
            </div>
        );
    }

    /**
     * The TestLong shows the details for a single test run, and its (truncated) logs
     */
    function TestLog(props) {
        var {run, test, logs} = props;
        var datestring = (new Date(props.session.date_added)).toUTCString();
        var split = logs.split('\n');
        var truncated = split.slice(Math.max(0, split.length-35));
        var final = truncated.join('\n');

        return (
            <div className="testmanager-run">
                <table>
                    <tbody>
                    <tr><th>{gettext('Test')}</th><td>{test.name}</td></tr>
                    <tr><th>{gettext('Date')}</th><td>{datestring}</td></tr>
                    <tr><th>{gettext('Result')}</th><TestResultCell code={test.last_code} /></tr>
                    </tbody>
                </table>
                <hr />
                {truncated.length == split.length ? null : <p>{interpolate(gettext('Showing last %s lines of %s:'), [truncated.length, split.length])}</p>}
                <pre>{final}</pre>
                {run.logs
                    ? <a href={run.logs} target="_blank">{gettext('Download logs')}</a>
                    : <span>{gettext('No logs to show')}</span>
                    }
            </div>
        );
    }


    /**
     * A simple animated loading bar div
     */
    function Loading() {
        return (
            <div className="progress progress-striped active">
                <div className="bar"></div>
            </div>);
    }

    /**
     * The Dashboard shows the list of all tests and jobs
     */
    function Dashboard(props) {
        var top_page = props.route[0] ? props.route[0].page : null;
        var top_id = props.route[0] ? props.route[0].id : null;
        return (
            <div>
                <Well>
                    <h2>{gettext('Tests')}</h2>
                    <TestList tests={props.tests} selected={top_page == 'test' ? top_id: null}/>
                </Well>
                <Well>
                    <h2>{gettext('Jobs')}</h2>
                    <SessionList sessions={props.sessions} selected={top_page == 'session' ? top_id: null}/>
                </Well>
            </div>
        );
    }

    /** Error renders a big scary red error Well with an 'X' button for closing */
    function Error(props) {
        return (
            <Well className="alert alert-error" >
                <button className="button-close" onClick={props.onClick}>⨉</button>
                <p>{interpolate(gettext("Error: %s trying to fetch %s"), [props.errorThrown, props.errorFor])}</p>
                <pre>{props.jqXHR.responseText}</pre>
            </Well>
        )
    }


    /**
     * Main strings everything together, rendering the dashboard on the left, detail page on the right, "run tests"
     * button and any errors.
     */
    var Main = React.createClass({
        getInitialState: function() {
            return _.extend({'error': null}, Route.initial(), Sessions.initial(), Tests.initial(), Runs.initial());
        },
        componentDidMount: function() {
            // Listen to all stores
            this.listener = _.extend({}, Backbone.Events);
            _.each([Route, Tests, Sessions, Runs], function(store) {
                this.listener.listenTo(store, 'changed', (data) => this.setState(data));
                this.listener.listenTo(store, 'error', (error) => this.setState({'error': error}));
            }, this);
            Route.refresh();
            Tests.refresh();
            Sessions.refresh();
        },
        componentWillUnmount: function() {
            this.listener.stopListening();
        },
        renderPage: function () {
            var {route, tests, sessions, runs} = this.state;
            var session, test, run;
            if (route.length == 0) return null;
            var {page, id} = route[route.length-1];
            switch (page) {
                case 'session':
                    session = _.findWhere(sessions, {id: id});
                    return (<SingleSession {...session} runs={runs} />);
                case 'test':
                    test = _.findWhere(tests, {id: id});
                    return (<SingleTest {...test} runs={runs}/>);
                case 'loading':
                    return (<Loading />);
                case 'logs':
                    run = _.findWhere(runs, {id: id});
                    test = _.findWhere(tests, {id: run.test.id});
                    session = _.findWhere(sessions, {id: run.session_id});
                    return (<TestLog logs = {Runs.logsFor(id)} run={run} session={session} test={test}/>);
                case 'error':
                    return (<Error error={route.error} />)
            }
        },
        onRunAll: function() {
            Sessions.new();
        },
        closeError: function() {
            this.setState({'error': null});
        },
        render: function() {
            var {route, tests, sessions, error} = this.state;
            var className = 'testmanager-page-'+(route.length == 0 ? 'dashboard' : 'detail');
            return (
                <div className={className}>
                    {!error ? null : <Error {...error} onClick={this.closeError} />
                        }
                    {tests.length == 0 ? null : (
                    <Well>
                        <button onClick={this.onRunAll} className='btn btn-affirmative'>{gettext('Run All')}</button>
                    </Well>)}
                    <div className="leftside">
                        <Dashboard sessions={sessions} tests={tests} route={route}/>
                    </div>
                    <div className="rightside">
                        {route.length == 0 ? null :
                            <Well>
                                <Anchor className={'testmanager-backbutton-'+route.length} onClick={()=>Route.up()}>← {gettext('Back')}</Anchor>
                                {this.renderPage()}
                            </Well>
                        }
                    </div>
                </div>
            );
        }
    });

    return {
        render: function(element, props) {
            var elm = React.createElement(Main, props);
            ReactDOM.render(elm, element);
        },
        refresh: function() {
            _.each(Sessions, Tests, Runs, function(api) {
                api.refresh();
            });
        }
    };
});
