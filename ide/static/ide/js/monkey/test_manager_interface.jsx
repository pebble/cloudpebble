CloudPebble.TestManager.Interface = (function(API) {
    const CODES = {
        '-2': gettext('error'),
        '-1': gettext('failed'),
        '0': gettext('pending'),
        '1': gettext('passed')
    };

    function SessionKindLabel(props) {
        return (<div>{(props.long ?
            (props.kind == 'live' ? gettext('Run in CloudPebble') : gettext('Batch run')) :
            (props.kind == 'live' ? gettext('Live') : gettext('Batch')))
        }</div>)
    }

    /**
     * The Pagination object is a mixin providing most of the functions needed to support and
     * render a pagination switcher.
     * Classes which use Pagination should define this.pageSize and have a 'getLength()' function.
     */
    const Pagination = {
        /**
         * Given a number of pages and current page, generate Pagination indexes
         * @param page
         * @param pageMax
         * @param delta the number of items to show on each side of the current page
         * @param minimum_bounds the guaranteed number of items to show at each end
         * @param dot_coverage the minimum number of dots to represent with a '...'
         * @returns {Array.<String|Number>} an array of numbers and one or two '...' strings
         */
        calculatePaging: function(page, pageMax, delta = 2, minimum_bounds = 1, dot_coverage = 2) {
            if (pageMax == 1) return [1];
            // 'left' and 'right' represent the indices of the pages to show around the current page.
            let left = page - delta;
            let right = page + delta;
            // If they are close enough to first or last pages, shift them
            if (left <= minimum_bounds + dot_coverage) {
                left -= (dot_coverage - 1);
            }
            if (right >= pageMax - minimum_bounds - dot_coverage + 1) {
                right += (dot_coverage - 1);
            }
            // Ensure that 'left'/'right' don't cross into the boundary pages
            left = Math.max(left, minimum_bounds + 1);
            right = Math.min(right, pageMax - minimum_bounds);
            // Build the list of pages to show
            let range = _.range(1, minimum_bounds + 1).concat(_.range(left, right + 1), _.range(pageMax - minimum_bounds + 1, pageMax + 1));
            // Add '...'s to fill in the gaps, if necessary
            if (left > dot_coverage + minimum_bounds) range.splice(minimum_bounds, 0, '...l');
            if (right < pageMax - minimum_bounds - dot_coverage + 1) range.splice(range.length - (minimum_bounds), 0, '...r');
            return range;
        },
        getInitialState: function() {
            return {
                page: 0
            }
        },
        gotoPage: function(n) {this.setState({page: Math.max(0, Math.min(this.maxPages(), n))});},
        maxPages: function() {return Math.floor((this.getLength() - 1) / this.pageSize);},
        page: function(arr) {return arr.slice(this.state.page * this.pageSize, (this.state.page + 1) * this.pageSize);},
        renderButton: function(num) {
            const className = classNames('btn', {
                'selected': num - 1 == this.state.page
            });

            return (_.isString(num)
                    ? <button key={num} className="btn" disabled="disabled">...</button>
                    : <button key={num} className={className}
                              onClick={()=>{this.gotoPage(num-1)}}>{num}</button>
            );
        },
        fillEmpty: function(items) {
            const num_fillers = this.pageSize - items.length;
            return items.concat(_.map(new Array(num_fillers), function(_, i) {
                return (<tr key={-i-1} className={"testmanager-table-filler"}></tr>)
            }));
        },
        renderPager: function() {
            const pageMax = this.maxPages();
            if (pageMax <= 0) return null;
            const indices = this.calculatePaging(this.state.page + 1, pageMax + 1);
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
        let {className, children, ...other} = props;
        const finalClassName = classNames('well', className);
        return <div className={finalClassName} {...other}>{children}</div>;
    }

    /**
     * The 'Anchor' class is an <a> tag which automatically preventDefaults clicks.
     */
    function Anchor(props) {
        const {onClick, children, ...other} = props;
        const clicked = function(event) {
            event.preventDefault();
            if (_.isFunction(onClick)) {
                onClick();
            }
            return false;
        };
        return (<a href='' {...other} onClick={clicked}>{children}</a>);
    }

    /**
     * Renders a <td> with the colour/content sent to represent a test result
     */
    function TestResultCell(props) {
        const result_name = CODES[props.code];
        const classes = "test-run test-" + result_name;
        return (<td className={classes}>{result_name}</td>);
    }

    function ViewTestSourceLink(props) {
        const onClick = function() {
            const file = CloudPebble.Editor.GetAllFiles()[props.name];
            CloudPebble.Editor.Open(file);
        };
        return (<Anchor onClick={onClick}>Edit</Anchor>)
    }

    /**
     * TestList allows navigation between each individual tests
     */
    const TestList = React.createClass({
        mixins: [Pagination],
        pageSize: 5,
        getLength: function() {
            return this.props.tests.length;
        },
        render: function() {
            let tests = this.page(this.props.tests).map((test) => {
                const onClickTest = function() {
                    API.Route.navigate('tests', test.id);
                };
                const className = classNames("clickable", {
                    selected: (this.props.selected == test.id)
                });
                return (
                    <tr key={test.id} onClick={onClickTest} className={className}>
                        <td>{test.name}</td>
                        <TestResultCell code={test.last_code}/>
                        <td><ViewTestSourceLink name={test.name}/></td>
                    </tr>
                );
            });
            tests = this.fillEmpty(tests);
            return (
                <div>
                    <table className="table" id="testmanager-test-table">
                        <thead>
                        <tr>
                            <th>{gettext('Name')}</th>
                            <th>{gettext('Last Status')}</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>{tests}</tbody>
                    </table>
                    {this.renderPager()}
                </div>
            );
        }
    });

    const RunTitle = function(props) {
        const titleClassName = classNames({
            'monkey-run-deleted': (!props.run.test)
        });
        return (<span className={titleClassName}>{props.run.name}</span>)
    };

    /**
     * RunList shows a list of test runs, e.g. for a single test or session
     */
    const RunList = React.createClass({
        mixins: [Pagination],
        pageSize: 18,
        getLength: function() {
            return _.keys(this.props.runs).length;
        },
        renderRow: function(run) {
            const datestring = CloudPebble.Utils.FormatDatetime(run.date_added);
            const show_logs = function() {
                if (run.test) {
                    API.Route.navigate('/logs', run.id);
                }
            };
            return (
                <tr key={run.id} className="clickable" onClick={show_logs}>
                    {!this.props.test && <td><RunTitle run={run}/></td>}
                    {!this.props.session && <td>{datestring}</td>}
                    <TestResultCell code={run.code}/>
                    <td>{run.platform}</td>
                </tr>
            );
        },
        render: function() {
            const paged_runs = this.page(this.props.runs);
            if (_.keys(paged_runs).length == 0) {
                return (<p>{gettext('This test has never been run!')}</p>);
            }
            let children = _.map(paged_runs, this.renderRow);
            children = this.fillEmpty(children);

            return (
                <div>
                    <table className="table" id="testmanager-run-table">
                        <thead>
                        <tr>
                            {this.props.test ? null : <th>{gettext('Name')}</th>}
                            {this.props.session ? null : <th>{gettext('Date')}</th>}
                            <th>{gettext('Status')}</th>
                            <th>{gettext('Platform')}</th>
                        </tr>
                        </thead>
                        <tbody>{children}</tbody>
                    </table>
                    {this.renderPager()}
                </div>
            )
        }
    });


    const SessionListRow = React.createClass({
        getInitialState: function() {
            return {flashing: !!this.props.session.is_new};
        },
        componentDidMount: function() {
            if (this.state.flashing) {
                setTimeout(() => {
                    this.setState({flashing: false});
                }, 1500);
            }
        },
        onClickSession: function() {
            API.Route.navigate('sessions', this.props.session.id);
        },
        render: function() {
            const session = this.props.session;
            const datestring = CloudPebble.Utils.FormatDatetime(session.date_added);
            const rowClassName = classNames("clickable", {
                selected: (this.props.selected),
                flash: (this.state.flashing)
            });
            const passesClassName = classNames({
                'test-failed': session.fails > 0,
                'test-passed': session.passes == session.run_count,
                'test-pending': session.fails == 0 && (session.passes != session.run_count)
            });

            return (
                <tr className={rowClassName} onClick={this.onClickSession}>
                    <td>{datestring}</td>
                    <td><SessionKindLabel kind={session.kind} long={false}/></td>
                    <TestResultCell code={session.status}/>
                    <td className={passesClassName}>{session.passes + '/' + session.run_count}</td>
                </tr>
            )
        }
    });

    /**
     * SessionList allows navigation through every test job.
     */
    const SessionList = React.createClass({
        mixins: [Pagination],
        pageSize: 10,
        getLength: function() {
            return this.props.sessions.length;
        },
        render: function() {
            let sessions = this.page(this.props.sessions).map((session) => {
                return (<SessionListRow key={session.id} session={session}
                                        selected={this.props.selected == session.id}/>);
            });
            sessions = this.fillEmpty(sessions);
            return (
                <div>
                    <table className="table" id="testmanager-job-table">
                        <thead>
                        <tr>
                            <th>{gettext('Date')}</th>
                            <th>{gettext('Kind')}</th>
                            <th>{gettext('Status')}</th>
                            <th>{gettext('Passes')}</th>
                        </tr>
                        </thead>
                        <tbody>{sessions}</tbody>
                    </table>
                    {this.renderPager()}
                </div>);
        }
    });

    /**
     * SingleSession shows the info for a particular testing job, and all the tests run for it.
     */
    function SingleSession(session) {
        const filtered = _.filter(session.runs, (run) => { return run.session_id == session.id });
        const datestring = CloudPebble.Utils.FormatDatetime(session.date_added);
        return (
            <div>
                <table className="infoTable">
                    <tbody>
                    <tr>
                        <th>{gettext('Date')}</th>
                        <td>{datestring}</td>
                    </tr>
                    <tr>
                        <th>{gettext('Passes')}</th>
                        <td>{(_.countBy(filtered, 'code')[1] || 0) + '/' + filtered.length}</td>
                    </tr>
                    <tr>
                        <th>{gettext('Test Kind')}</th>
                        <td><SessionKindLabel kind={session.kind} long={true}/></td>
                    </tr>
                    </tbody>
                </table>
                <RunList runs={filtered} session={session}/>
            </div>
        );
    }

    /**
     * SingleTest shows the details for a single test, and all times it has been run
     */
    function SingleTest(test) {
        const filtered = _.filter(test.runs, (run) => {return !_.isUndefined(run.test) && run.test.id == test.id });
        // TODO: 'goto source'
        return (
            <div id="testmanager-test">
                <table className="infoTable">
                    <tbody>
                    <tr>
                        <th>{gettext('Test')}</th>
                        <td>{test.name}</td>
                    </tr>
                    <tr>
                        <th>{gettext('Passes')}</th>
                        <td>{(_.countBy(filtered, 'code')[1] || 0) + '/' + filtered.length}</td>
                    </tr>
                    <tr>
                        <td></td>
                        <td><ViewTestSourceLink name={test.name}/></td>
                    </tr>
                    </tbody>
                </table>
                <RunList runs={filtered} test={test}/>
            </div>
        );
    }

    /**
     * A LogArtefact is a link to a resource inside a log script which shows a popover if it is an image
     */
    const LogArtefact = React.createClass({
        url: function() {
            // TODO: consider a way of getting this URL from Django instead of hardcoding it.
            return '/orchestrator/artefacts/' + this.props.link;
        },
        componentDidMount: function() {
            if (this.props.link.endsWith("png")) {
                $(this.refs.a).popover({
                    animation: false,
                    delay: {show: 250},
                    container: 'body',
                    trigger: 'hover',
                    html: true,
                    placement: 'top',
                    content: `<img src="${this.url()}" />`
                });
            }
        },
        render: function() {
            return (<a ref='a' target="_blank" href={this.url()}>{this.props.name}</a>);
        }
    });

    /**
     * LogScript renders a pebblesdk test log in react, converting artefact links to actual links.
     */
    function LogScript(props) {
        const log = props.log;
        const artefacts = props.artefacts || [];
        const filename = function(str) {
            return str.substring(str.lastIndexOf('/') + 1);
        };

        // Build up a list of the locations of all artefacts
        const matches = [];
        let start = 0;
        do {
            // Log through the log file, find the closest match to the current position
            const match = artefacts.reduce((closest, match, i) => {
                const pos = log.indexOf(artefacts[i][0], start);
                return (pos > closest.pos || pos == -1) ? closest : {
                    pos: pos,
                    found: artefacts[i][0],
                    replace: artefacts[i][1]
                };
            }, {pos: Infinity});

            // Add the match to the list and roll the current position forward
            matches.push(match);
            start = match.pos + 1;
        }
        while (start < Infinity);

        // Replace each artefact match with a link to the artefact.
        const pieces = [];
        matches.reduce((pos, match, i) => {
            pieces.push(log.slice(pos, match.pos));
            if (match.replace) {
                pieces.push(<LogArtefact key={i} name={filename(match.found)} link={filename(match.replace)}/>);
                pos = match.pos + match.found.length;
                return pos;
            }
        }, 0);

        // Return the list of log elements inside a <pre>
        return (
            <pre className="test-script">{pieces}</pre>
        )
    }

    /**
     * The TestRun shows the details for a single test run, and its logs
     */
    function TestRun(props) {
        const {run, test, logs, session} = props;
        const datestring = CloudPebble.Utils.FormatDatetime(session.date_added);
        const is_live_log = (!!logs && !run.logs);
        const run_completed = run.date_completed ? CloudPebble.Utils.FormatDatetime(run.date_completed) : null;
        return (
            <div className="testmanager-run">
                <table>
                    <tbody>
                    <tr>
                        <th>{gettext('Test')}</th>
                        <td><Anchor onClick={() => {API.Route.navigate('/tests', test.id)}}>{test.name}</Anchor>
                        </td>
                    </tr>
                    <tr>
                        <th>{gettext('Platform')}</th>
                        <td> {run.platform} </td>
                    </tr>
                    <tr>
                        <th>{gettext('Session')}</th>
                        <td><Anchor
                            onClick={() => {API.Route.navigate('/sessions', session.id)}}>{datestring}</Anchor></td>
                    </tr>
                    {run_completed && <tr>
                        <th>{gettext('Completion date')}</th>
                        <td>{run_completed}</td>
                    </tr>}
                    <tr>
                        <th>{gettext('Result')}</th>
                        <TestResultCell code={run.code}/></tr>
                    </tbody>
                </table>
                <hr />
                <LogScript log={logs} artefacts={run.artefacts}/>
                {!!run.logs && <a href={run.logs} target="_blank">{gettext('Download logs')}</a>}
                {(!run.logs && !is_live_log) && <span>{gettext('No logs to show')}</span>}
                {is_live_log && <span>Test in progress</span>}
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
     * Renders a button which starts all tests in batch mode when clicked.
     */
    const BatchRunButton = React.createClass({
        getInitialState: function() {
            return {batch_waiting: false};
        },
        onClick: function() {
            this.setState({batch_waiting: true});
            API.Sessions.new().finally(() => {
                this.setState({batch_waiting: false});
            });
        },
        render: function() {
            return (<button onClick={this.onClick} className='btn btn-affirmative'
                            disabled={this.state.batch_waiting ? "disabled" : null}>{gettext('Batch run')}</button>)
        }
    });

    /**
     * Button to download all the tests as a zip
     */
    function TestDownloadButton(props) {
        return (<a href={'/ide/project/'+props.project_id+'/tests/archive'}
                   className='btn testmanager-download-btn'>{gettext('Download tests as zip')}</a>);
    }

    /**
     * The Dashboard shows the list of all tests and jobs
     */
    function Dashboard(props) {
        const top_page = props.route[0] ? props.route[0].page : null;
        const top_id = props.route[0] ? props.route[0].id : null;
        return (
            <div>
                {props.tests.length > 0 && (
                    <Well>
                        <BatchRunButton />
                        <TestDownloadButton project_id={props.project_id}/>
                    </Well>
                )}
                <Well>
                    <h2>{gettext('Tests')}</h2>
                    <TestList tests={props.tests} selected={top_page == 'tests' ? top_id: null}/>
                </Well>
                <Well>
                    <h2>{gettext('Jobs')}</h2>
                    <SessionList sessions={props.sessions} selected={top_page == 'sessions' ? top_id: null}/>
                </Well>
            </div>
        );
    }

    /** Error renders a big scary red error Well with an 'X' button for closing */
    function Error(props) {
        return (
            <Well className="alert alert-error">
                <button className="button-close" onClick={props.onClick}>⨉</button>
                <p>{interpolate(gettext("Error trying to fetch %s: %s"), [props.errorFor, props.text])}</p>
            </Well>
        )
    }

    function BackButton(props) {
        const mapping = {
            logs: gettext('Run'),
            tests: gettext('Test'),
            sessions: gettext('Session')
        };
        const route = props.route;
        let page, id, text;
        if (route.length > 1) {
            page = mapping[route[route.length - 2].page];
            id = route[route.length - 2].id;
            text = interpolate(gettext('← Back to %s %s'), [page, id]);
        }
        else {
            text = gettext('← Back');
        }
        return (
            <Anchor
                id='testmanager-backbutton'
                className={'testmanager-backbutton-'+route.length}
                onClick={() => {API.Route.up()}}>
                {text}
            </Anchor>
        )
    }

    /**
     * TestPage renders a different page depending on the current route.
     */
    function TestPage(props) {
        const route = props.route;
        let session, test, run, log;
        if (route.length == 0) return null;
        const page = route[route.length - 1].page;
        const id = route[route.length - 1].id;
        switch (page) {
            case 'sessions':
                session = _.findWhere(props.sessions, {id: id});
                return (<SingleSession {...session} runs={props.runs}/>);
            case 'tests':
                test = _.findWhere(props.tests, {id: id});
                return (<SingleTest {...test} runs={props.runs}/>);
            case 'loading':
                return (<Loading />);
            case 'logs':
                run = _.findWhere(props.runs, {id: id});
                test = _.findWhere(props.tests, {id: run.test.id});
                session = _.findWhere(props.sessions, {id: run.session_id});
                log = _.findWhere(props.logs, {id: id});
                return (<TestRun logs={log ? log.text : ''} run={run} session={session} test={test}/>);
        }
    }

    /**
     * The TestManager is parent UI for everything, rendering the dashboard on the left, detail page on the right,
     * "run tests" button and any errors.
     */
    function TestManager(props) {
        const route = props.route;
        const is_log = (route.length > 0 && (route[route.length - 1].page == 'logs'));
        const className = 'testmanager-page-' + (route.length == 0 ? 'dashboard' : 'detail');

        // This logic is used to always render test logs across the full screen width.
        const leftclass = is_log ? 'hide' : 'leftside';
        const rightclass = is_log ? '' : 'rightside';

        return (
            <div className={className}>
                {!!props.error && <Error {...props.error} onClick={props.closeError}/>}
                <div className={leftclass}>
                    <Dashboard sessions={props.sessions} tests={props.tests} route={route}
                               project_id={props.project_id}/>
                </div>
                <div className={rightclass}>
                    {route.length > 0 &&
                    <Well>
                        <BackButton route={route}/>
                        <TestPage {...props} />
                    </Well>
                    }
                </div>
            </div>
        );
    }

    /**
     * Renders the text and "create a test" button displayed when the user has no tests or test runs.
     */
    const NoTestsDisplay = function(props) {
        const createTest = function() {
            CloudPebble.Editor.CreateTest();
        };
        return (
            <Well>
                <div className='monkey-no-tests'>
                    <p>The Test Manager allows lets you browse results and logs for your project's automated tests.</p>
                    <p>
                        <button className="btn btn-small" onClick={createTest}>Create a test</button>
                        to get started
                    </p>
                </div>
            </Well>
        )
    };

    /**
     * The TestManagerContainer listens to data changes and passes them to the UI.
     */
    const TestManagerContainer = React.createClass({
        getInitialState: function() {
            return _.extend({'error': null}, API.Route.initial(), API.Sessions.initial(), API.Tests.initial(), API.Runs.initial());
        },
        componentDidMount: function() {
            // Listen to all stores
            this.listener = _.extend({}, Backbone.Events);
            _.each([API.Route, API.Tests, API.Sessions, API.Runs, API.Logs], (store) => {
                this.listener.listenTo(store, 'changed', (data) => { this.setState(data) });
                this.listener.listenTo(store, 'error', (error) => { this.setState({'error': error}) });
            });
        },
        closeError: function() {
            this.setState({'error': null});
        },
        componentWillUnmount: function() {
            this.listener.stopListening();
        },
        render: function() {
            if (this.state.tests.length == 0 && this.state.sessions.length == 0) {
                return (<NoTestsDisplay />)
            }
            else {
                return (<TestManager {...this.state} {...this.props} closeError={this.closeError}/>)
            }

        }
    });

    return {
        render: function(element, props) {
            const elm = React.createElement(TestManagerContainer, props);
            ReactDOM.render(elm, element);
        },
        refresh: function() {
            _.each(API.Sessions, API.Tests, API.Runs, (api) => {
                api.refresh();
            });
        }
    };
});
