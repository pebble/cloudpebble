CloudPebble.MonkeyScreenshots.Interface = (function(Screenshots, Platforms) {
    'use strict';

    /** A simple progress bar*/
    function ProgressView(props) {
        return (
            <div className="progress progress-striped active">
                <div className="bar" style={{width: props.progress+'%'}}></div>
            </div>
        )
    }

    /** Render a list of errors */
    function Error(props) {
        const errFor = props.errorFor ? interpolate(gettext(" trying to %s"), [props.errorFor]) : "";
        const message = props.message;
        return (
            <div className="errors">
                <div className="well alert alert-error">
                    <p>{interpolate(gettext("Error%s: %s"), [errFor, message])}</p>
                </div>
            </div>
        );
    }

    /** An interactive editable screenshot tile */
    const Screenshot = React.createClass({
        getInitialState: function() {
            return {
                dragging: false
            }
        },
        stopEvent: function(event) {
            event.preventDefault();
            event.stopPropagation();
        },
        uploadFiles: function(fileList) {
            const files = [];
            _.each(fileList, function(file, i) {
                files[i] = file;
            });
            Screenshots.addUploadedFiles(files, this.props.index, this.props.platform);
        },
        onInputChange: function(event) {
            this.uploadFiles(event.target.files);
        },
        onDrop: function(event) {
            this.stopEvent(event);
            this.setState({dragging: false});
            this.uploadFiles(event.nativeEvent.dataTransfer.files);
        },
        onDragEnter: function(event) {
            this.stopEvent(event);
            this.setState({dragging: true});
        },
        onDragLeave: function(event) {
            this.stopEvent(event);
            this.setState({dragging: false});
        },
        onDragOver: function(event) {
            this.stopEvent(event);
            if (!this.state.dragging) this.setState({dragging: true});
            event.nativeEvent.dataTransfer.dropEffect = 'copy';
        },
        onClickDelete: function() {
            Screenshots.deleteFile(this.props.index, this.props.platform);
        },
        onClickUpload: function() {
            $(this.refs.fileInput).click();
        },
        onClickScreenshot: function() {
            Screenshots.takeScreenshot(this.props.index, this.props.platform);
        },
        render: function() {
            const {file, disabled, platform, screenshotsEnabled} = this.props;
            const is_new = (!file ? false : file.is_new);
            const empty = (!file ? true : !file.src);
            const className = classNames('image-resource-preview', 'platform-' + platform, {
                'screenshot-empty': empty
            });
            const imageClasses = classNames({
                'monkey-modified': is_new,
                'monkey-hover': this.state.dragging && !disabled
            });
            const dragEvents = {
                onDragEnter: this.onDragEnter,
                onDragLeave: this.onDragLeave,
                onDragOver: this.onDragOver,
                onDrop: this.onDrop
            };

            const screenshotsDisabled = disabled || !screenshotsEnabled;

            if (!empty) {
                return (
                    <div className={className} {...dragEvents}>
                        <img src={file.src} className={imageClasses}/>
                        <button className="btn delete-btn" type="button" onClick={this.onClickDelete}></button>
                    </div>
                )
            }
            else {
                return (
                    <div className={classNames(className, imageClasses)} {...dragEvents}>
                        <div {...dragEvents}>
                            <button className="btn" onClick={this.onClickUpload} type="button"
                                    disabled={disabled}>{gettext('Upload file')}</button>
                            <br />
                            <button className="btn" onClick={this.onClickScreenshot} type="button"
                                    disabled={screenshotsDisabled}>{gettext('Take Screenshot')}</button>
                            <input ref="fileInput" className="hide" type="file" multiple onChange={this.onInputChange}
                                   disabled={disabled}/>
                        </div>

                    </div>
                )
            }
        }
    });

    function ScreenshotTitle(props) {
        const className = classNames("monkey-screenshot-title", {
            'will-delete': props.will_delete
        });
        const onChange = function(event) {
            Screenshots.setName(props.index, event.target.value);
        };
        return (
            <div className={className}>
                <input className="monkey-editing"
                       value={props.name}
                       type="text"
                       placeholder={gettext("Screenshot name")}
                       required={!props.will_delete}
                       pattern="[a-zA-Z0-9_-]+"
                       onChange={onChange}
                       disabled={props.disabled}
                />
                {props.changed && (
                    <span className="settings-status-icons">
                    <span className="monkey-changed icon-edit"> </span>
                </span>
                )}
            </div>
        )
    }

    function ScreenshotSet(props) {
        const will_delete = !props.is_new_set && _.every(props.files, function(file) {return !file.file && !file.src});
        if (will_delete && (_.isUndefined(props.id) || _.isNull(props.id)) && props.name.length == 0) {
            return null;
        }
        const className = classNames("monkey-screenshot-set", {
            disabled: props.disabled
        });

        return (
            <div className={className}>
                <div className={props.will_delete ? 'will-delete' : null}>
                    {props.platforms.map(function(platform) {
                        return (
                            <div key={platform} className="monkey-screenshot-container">
                                {props.progress && _.has(props.progress, platform)
                                    ?
                                    <ProgressView progress={props.progress[platform]}/>
                                    :
                                    <Screenshot
                                        index={props.index}
                                        file={props.files[platform]}
                                        platform={platform}
                                        disabled={props.disabled}
                                        screenshotsEnabled={props.screenshotsEnabled}
                                    />
                                }
                            </div>
                        )
                    })}
                </div>
                {!props.is_new_set &&
                <ScreenshotTitle will_delete={props.will_delete} name={props.name} index={props.index}
                                 changed={props._changed} disabled={props.disabled}/> }
                {props.will_delete && <div
                    className='monkey-screenshot-will-delete-warning'>{gettext('This screenshot set will be deleted')}</div>}
            </div>
        )
    }

    /** A form which displays all current screenshots,
     * and an extra row for adding new screenshots
     */
    function ScreenshotForm(props) {
        const onSubmit = function(event) {
            event.preventDefault();
            Screenshots.save();
        };
        return (
            <form className="monkey-form" id="monkey-form" onSubmit={onSubmit}>
                <div className="monkey-screenshots">
                    {props.screenshots.map(function(screenshot_set, index) {
                        return (
                            <ScreenshotSet key={index}
                                           index={index}
                                           is_new_set={false}
                                {...screenshot_set}
                                           platforms={props.platforms}
                                           disabled={props.disabled}
                                           screenshotsEnabled={props.screenshotsEnabled}
                                           progress={props.progress[index]}/>
                        )
                    })}
                    <ScreenshotSet index={null}
                                   is_new_set={true}
                                   changed={false}
                                   files={{}}
                                   platforms={props.platforms}
                                   disabled={props.disabled}
                                   screenshotsEnabled={props.screenshotsEnabled}
                                   progress={props.progress["null"]}/>
                </div>
            </form>
        )
    }

    /** A clickable title for toggling the sidebar state */
    function PlatformTitle(props) {
        const platform = props.platform;
        const onClick = function() {
            Platforms.toggle(platform);
        };
        return (<span className={'monkey-select-platform platform-'+platform} onClick={onClick}>{platform}</span>)
    }

    /** ScreenshotManager contains all of the screenshot manager UI */
    const ScreenshotManager = React.createClass({
        componentDidMount: function() {
            const help = gettext('<p>Click on the ＋ buttons or drag in image files to add screenshots to test against. </p>' +
                '<p>To add or modify the screenshots for a single platform across multiple sets of screenshots, ' +
                'drag in multiple images.</p>');
            $(this.refs.help).popover({
                trigger: 'hover',
                content: help,
                html: true,
                container: '#help-prompt-holder',
                placement: 'left',
                animation: false
            });
        },
        render: function() {
            const {screenshots, platforms, disabled, progress, activePebble, loading} = this.props;
            const stopEvent = function(event) {
                // We cancel any drop events over the UI so that the user doesn't experience unexpected behaviour of they
                // accidentally drop an image outside of a screenshot box.
                event.preventDefault();
                event.stopPropagation();
            };
            const onCancel = function() {
                CloudPebble.Prompts.Confirm(gettext("Reset all changes?"), gettext("This cannot be undone."), function() {
                    Screenshots.loadScreenshots();
                });
            };
            return (
                <div onDragOver={stopEvent} onDrop={stopEvent}>
                    <img ref="help" src="/static/ide/img/help.png" className="field-help" data-original-title=""/>
                    <h2>{gettext('Screenshots')}</h2>

                    {!!this.props.error && <Error {...this.props.error} />}

                    <div className="monkey-platforms">
                        {this.props.platforms.map((platform) => {
                            return (
                                <PlatformTitle key={platform} platform={platform}/>
                            )
                        })}
                    </div>
                    <ScreenshotForm screenshots={screenshots}
                                    platforms={platforms}
                                    disabled={disabled}
                                    progress={progress}
                                    screenshotsEnabled={activePebble}
                    />

                    {loading && <ProgressView progress={100}/>}

                    <div className="monkey-form-buttons">
                        <button className="btn btn-affirmative" type="submit" form="monkey-form"
                                disabled={disabled || !this.props.changed}>
                            {gettext('Save')}
                        </button>
                        <button className="btn btn-cancel" type="button" onClick={onCancel} disabled={disabled}>
                            {gettext('Reset')}
                        </button>
                    </div>
                </div>
            );
        }
    });

    /** ScreenshotManagerContainer listens to changes in screenshot model, and passes them to the UI */
    const ScreenshotManagerContainer = React.createClass({
        getInitialState: function() {
            return {
                screenshots: Screenshots.getScreenshots(),
                error: null,
                loading: false,
                disabled: false,
                platforms: Platforms.initial(),
                progress: {},
                activePebble: !!SharedPebble.getPebbleNow()
            }
        },
        componentDidMount: function() {
            this.listener = _.extend({}, Backbone.Events);
            // Listen to changes in the available platforms
            this.listener.listenTo(Platforms, 'changed', (state) => { this.setState(state) });
            // Listen to events which directly enable/disable the form
            this.listener.listenTo(Screenshots, 'disable', () => { this.setState({disabled: true}) });
            this.listener.listenTo(Screenshots, 'enable', () => { this.setState({disabled: false}) });
            // Listen to updates in screenshot and error information
            // If we get a 'changed' or 'error' event, we know that loading is done.
            this.listener.listenTo(Screenshots, 'changed', (screenshots) => {
                this.setState({
                    screenshots: screenshots,
                    error: null,
                    loading: false,
                    changed: Screenshots.isModified()
                })
            });
            this.listener.listenTo(Screenshots, 'error', (error) => {
                this.setState({
                    error: error,
                    loading: false
                })
            });
            // Listen to event indicating upload progress or things loading
            this.listener.listenTo(Screenshots, 'progress', (progress) => { this.setState({progress: progress}) });
            this.listener.listenTo(Screenshots, 'waiting', () => {
                this.setState({
                    loading: true
                })
            });
            // Listen to the activePebble
            this.listener.listenTo(SharedPebble, 'status', (pebble, code) => {
                if (code == 0) {
                    this.setState({activePebble: true});
                }
            });
            this.listener.listenTo(SharedPebble, 'close error', () => {
                this.setState({activePebble: false});
            });
        },
        componentWillUnmount: function() {
            this.listener.stopListening();
        },
        render: function(props) {
            return (<ScreenshotManager {...this.state} test_id={this.props.test_id}/>)
        }
    });

    return {
        render: function(element, props) {
            const elm = React.createElement(ScreenshotManagerContainer, props);
            ReactDOM.render(elm, element);
        }
    }
});
