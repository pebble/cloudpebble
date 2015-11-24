CloudPebble.MonkeyScreenshots.Interface = (function(Screenshots, Platforms) {

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
        let kind = props.errorThrown ? interpolate(" %s", [props.errorThrown]) : "";
        let errFor = props.errorFor ? interpolate(gettext(" trying to %s"), [props.errorFor]) : "";
        let multiline = ((props.text.match(/\n/g) || []).length > 0);
        let message = (!multiline ? ": "+props.text : '');
        return (
            <div className="errors">
                <div className="well alert alert-error">
                    <p>{interpolate(gettext("Error%s%s%s"), [kind, errFor, message])}</p>
                    {multiline && <pre>{props.text}</pre>}
                </div>
            </div>
        );
    }

    /** An interactive editable screenshot tile */
    let Screenshot = React.createClass({
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
            let files = [];
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
            let { platform, file, disabled } = this.props;
            let is_new = (!file ? false : file.is_new);
            let empty = (!file ? true : !file.src);
            let className = classNames('image-resource-preview', 'platform-'+platform, {
                'screenshot-empty': empty
            });
            let imageClasses = classNames({
                'monkey-modified': is_new,
                'monkey-hover': this.state.dragging && !disabled
            });
            let dragEvents = {
                onDragEnter: this.onDragEnter,
                onDragLeave: this.onDragLeave,
                onDragOver: this.onDragOver,
                onDrop: this.onDrop
            };

            if (!empty) {
                return (
                <div className={className} {...dragEvents}>
                    <img src={file.src} className={imageClasses} />
                    <button className="btn delete-btn" type="button" onClick={this.onClickDelete}> </button>
                </div>
                )
            }
            else {
                return (
                    <div className={classNames(className, imageClasses)} {...dragEvents}>
                        <div {...dragEvents}>
                            <button className="btn" onClick={this.onClickUpload} type="button" disabled={disabled}>{gettext('Upload file')}</button><br />
                            <button className="btn" onClick={this.onClickScreenshot} type="button" disabled={disabled}>{gettext('Take Screenshot')}</button>
                            <input ref="fileInput" className="hide" type="file" multiple onChange={this.onInputChange} disabled={disabled} />
                        </div>

                </div>
                )
            }
        }
    });

    function ScreenshotTitle(props) {
        let { will_delete, name, index, changed, disabled } = props;
        let className = classNames("monkey-screenshot-title", {
            'will-delete': will_delete
        });
        let onChange = function(event) {
            Screenshots.setName(index, event.target.value);
        };
        return (
            <div className={className}>
                <input className="monkey-editing"
                       value={name}
                       type="text"
                       placeholder={gettext("Screenshot name")}
                       required={!will_delete}
                       pattern="[a-zA-Z0-9_-]+"
                       onChange={onChange}
                       disabled={disabled}
                />
                {changed && (
                <span className="settings-status-icons">
                    <span className="monkey-changed icon-edit"> </span>
                </span>
                )}
            </div>
        )
    }

    function ScreenshotSet(props) {
        let { is_new_set, name, _changed, platforms, files, index, disabled, progress } = props;
        let will_delete = !is_new_set && _.every(files, (file) => !file.file && !file.src);
        if (will_delete && (_.isUndefined(props.id) || _.isNull(props.id)) && props.name.length == 0) {
            return null;
        }
        let className = classNames("monkey-screenshot-set", {
            disabled: disabled
        });

        return (
            <div className={className}>
                <div className={will_delete ? 'will-delete' : null}>
                {platforms.map((platform)=>(
                    <div key={platform} className="monkey-screenshot-container">
                        {progress && _.has(progress, platform)
                            ? <ProgressView progress={progress[platform]}/>
                            : <Screenshot index={index} file={files[platform]} platform={platform} disabled={disabled}/>
                        }
                    </div>
                ))}
                </div>
                {!is_new_set && <ScreenshotTitle will_delete={will_delete} name={name} index={index} changed={_changed} disabled={disabled} /> }
                {will_delete && <div className='monkey-screenshot-will-delete-warning'>{gettext('This screenshot set will be deleted')}</div>}
            </div>
        )
    }

    /** A form which displays all current screenshots,
     * and an extra row for adding new screenshots
     */
    function ScreenshotForm(props) {
        let { platforms, screenshots } = props;
        let onSubmit = function(event) {
            event.preventDefault();
            Screenshots.save();
        };
        return (
            <form className="monkey-form" id="monkey-form" onSubmit={onSubmit}>
                <div className="monkey-screenshots">
                    {screenshots.map((screenshot_set, index) => (
                        <ScreenshotSet key={index}
                                       index={index}
                                       is_new_set={false}
                                       {...screenshot_set}
                                       platforms={platforms}
                                       disabled={props.disabled}
                                       progress={props.progress[index]}/>
                        ))}
                    <ScreenshotSet index={null}
                                   is_new_set={true}
                                   changed={false}
                                   files={{}}
                                   platforms={platforms}
                                   disabled={props.disabled}
                                   progress={props.progress["null"]}/>
                </div>
            </form>
        )
    }

    /** A clickable title for toggling the sidebar state */
    function PlatformTitle(props) {
        let platform = props.platform;
        let onClick = function() {
            Platforms.toggle(platform);
        };
        return (<span className={'monkey-select-platform platform-'+platform} onClick={onClick}>{platform}</span>)
    }

    /** ScreenshotManager contains all of the screenshot manager UI */
    let ScreenshotManager = React.createClass({
        componentDidMount: function() {
            let help = gettext('<p>Click on the ＋ buttons or drag in image files to add screenshots to test against. </p>' +
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
            let stopEvent = function (event) {
                // We cancel any drop events over the UI so that the user doesn't experience unexpected behaviour of they
                // accidentally drop an image outside of a screenshot box.
                event.preventDefault();
                event.stopPropagation();
            };
            let onCancel = function () {
                CloudPebble.Prompts.Confirm(gettext("Reset all changes?"), gettext("This cannot be undone."), function () {
                    Screenshots.loadScreenshots();
                });
            };
            return (
                <div onDragOver={stopEvent} onDrop={stopEvent}>
                    <img ref="help" src="/static/ide/img/help.png" className="field-help" data-original-title=""/>
                    <h2>{gettext('Screenshots')}</h2>

                    {!!this.props.error && <Error {...this.props.error} />}

                    <div className="monkey-platforms">
                        {this.props.platforms.map((platform)=>(
                        <PlatformTitle key={platform} platform={platform}/>
                            ))}
                    </div>

                    <ScreenshotForm screenshots={this.props.screenshots} platforms={this.props.platforms}
                                    disabled={this.props.disabled} progress={this.props.progress}/>

                    {this.props.loading && <ProgressView progress={100} />}

                    <div className="monkey-form-buttons">
                        <button className="btn btn-affirmative"
                                type="submit"
                                form="monkey-form"
                                disabled={this.props.disabled}>{gettext('Save')}</button>
                        <button className="btn btn-cancel"
                                type="button"
                                onClick={onCancel}
                                disabled={this.props.disabled}>{gettext('Reset')}</button>
                    </div>
                </div>
            );
        }
    });

    /** ScreenshotManagerContainer listens to changes in screenshot model, and passes them to the UI */
    let ScreenshotManagerContainer = React.createClass({
        getInitialState: function() {
            return {
                screenshots: [],
                error: null,
                loading: false,
                disabled: false,
                platforms: Platforms.initial(),
                progress: {}
            }
        },
        componentDidMount: function() {
            this.listener = _.extend({}, Backbone.Events);
            // If we get a 'changed' or 'error' event, we know that loading is done.
            this.listener.listenTo(Platforms, 'changed', (state)=>this.setState(state));
            this.listener.listenTo(Screenshots, 'disable', (state)=>this.setState({disabled: true}));
            this.listener.listenTo(Screenshots, 'enable', (state)=>this.setState({disabled: false}));
            this.listener.listenTo(Screenshots, 'changed', (screenshots)=>this.setState({
                screenshots: screenshots,
                error: null,
                loading: false
            }));
            this.listener.listenTo(Screenshots, 'progress', (progress => this.setState({progress: progress})));
            this.listener.listenTo(Screenshots, 'error', (error) => this.setState({
                error: error,
                loading: false
            }));

            this.listener.listenTo(Screenshots, 'waiting', () => this.setState({
                loading: true
            }));
            Screenshots.loadScreenshots();
        },
        componentWillUnmount: function() {
            this.listener.stopListening();
        },
        render: function() {
            return (<ScreenshotManager {...this.state}/>)
        }
    });

    return {
        render: function(element, props) {
            let elm = React.createElement(ScreenshotManagerContainer, props);
            ReactDOM.render(elm, element);
        }
    }
});
