CloudPebble.MonkeyScreenshots.Interface = (function(Screenshots, Platforms) {

    /** A simple progress bar*/
    function ProgressView() {
        return (
                <div className="progress progress-striped active">
                    <div className="bar" style={{width: '100%'}}></div>
                </div>
        )
    }

    /** Render a list of errors */
    function Error(props) {
        return (
            <div className="errors">
                <div className="well alert alert-error">
                    <p>{interpolate(gettext("Error: %s trying to %s"), [props.errorThrown, props.errorFor])}</p>
                    <pre>{props.jqXHR.responseText}</pre>
                </div>
            </div>
        );
    }

    /** An interactive editable screenshot tile */
    var Screenshot = React.createClass({
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
            var files = [];
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
            event.nativeEvent.dataTransfer.dropEffect = 'copy';
        },
        onClickDelete: function() {
            Screenshots.deleteFile(this.props.index, this.props.platform);
        },
        onClick: function(e) {
            // fileInput comes from the <input>'s refs
            $(this.refs.fileInput).click();
            e.stopPropagation();
            e.preventDefault();
        },
        render: function() {
            var {platform, file, disabled} = this.props;
            var is_new = (!file ? false : file.is_new);
            var empty = (!file ? true : !file.src);
            var empty_img = '/static/common/img/screenshot-empty' + (this.props.platform == 'chalk' ? '-chalk.png' : '.png');
            var src = (!empty && file.src ? file.src : empty_img);
            var className = classNames('image-resource-preview', 'platform-'+platform, {
                'screenshot-empty': empty
            });
            var imageClasses = classNames({
                'monkey-modified': is_new,
                'monkey-hover': this.state.dragging
            });
            return (
                <div className={className}>
                    <img onDragEnter={this.onDragEnter}
                         onDragLeave={this.onDragLeave}
                         onDragOver={this.onDragOver}
                         onDrop={this.onDrop}
                         onClick={this.onClick}
                         src={src}
                         className={imageClasses} />
                    <input ref="fileInput" type="file" className="hide" multiple onChange={this.onInputChange} disabled={disabled} />
                    {!empty && <button className="btn delete-btn" type="button" onClick={this.onClickDelete}> </button>}
                </div>
            );
        }
    });

    /** A row of screenshots, which may include a title */
    function ScreenshotSet(props) {
        var {is_new_set, name, _changed, platforms, files, index, disabled} = props;

        var onChange = function(event) {
            Screenshots.setName(index, event.target.value);
        };
        var will_delete = !is_new_set && _.every(files, (file) => !file.file && !file.src);
        var titleClassName = classNames("monkey-screenshot-title", {
            'will-delete': will_delete
        });
        var className = classNames("monkey-screenshot-set", {
            disabled: disabled
        });
        if (will_delete && (_.isUndefined(props.id) || _.isNull(props.id)) && props.name.length == 0) {
            return null;
        }

        return (
            <div className={className}>
                <div className={will_delete ? 'will-delete' : null}>
                {platforms.map((platform)=>(
                    <Screenshot index={index} key={platform} file={files[platform]} platform={platform} disabled={disabled} />
                ))}
                </div>
                {!is_new_set && (
                    <div className={titleClassName}>
                        <input className="monkey-editing"
                               value={name}
                               type="text"
                               placeholder={gettext("Screenshot name")}
                               required={!will_delete}
                               pattern="[a-zA-Z0-9_-]+"
                               onChange={onChange}
                               disabled={disabled}
                        />
                        {_changed && (
                        <span className="settings-status-icons">
                            <span className="monkey-changed icon-edit"> </span>
                        </span>
                        )}
                    </div>
                    )}
                {will_delete && <div className='monkey-screenshot-will-delete-warning'>{gettext('This screenshot set will be deleted')}</div>}
            </div>
        )
    }

    /** A form which displays all current screenshots,
     * and an extra row for adding new screenshots
     */
    function ScreenshotForm(props) {
        var {platforms, screenshots} = props;
        var onSubmit = function(event) {
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
                                       disabled={props.disabled} />
                        ))}
                    <ScreenshotSet index={null}
                                   is_new_set={true}
                                   changed={false}
                                   files={{}}
                                   platforms={platforms}
                                   disabled={props.disabled} />
                </div>
            </form>
        )
    }

    /** A clickable title for toggling the sidebar state */
    function PlatformTitle(props) {
        var platform = props.platform;
        var onClick = function() {
            Platforms.toggle(platform);
        };
        return (<span className={'monkey-select-platform platform'+platform} onClick={onClick}>{platform}</span>)
    }

    /** ScreenshotManager contains all of the screenshot manager UI */
    var ScreenshotManager = React.createClass({
        componentDidMount: function() {
            var help = gettext('<p>Click on the ＋ buttons or drag in image files to add screenshots to test against. </p>' +
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
            var stopEvent = function (event) {
                // We cancel any drop events over the UI so that the user doesn't experience unexpected behaviour of they
                // accidentally drop an image outside of a screenshot box.
                event.preventDefault();
                event.stopPropagation();
            };
            var onCancel = function () {
                CloudPebble.Prompts.Confirm(gettext("Reset all changes?"), gettext("This cannot be undone."), function () {
                    Screenshots.loadScreenshots();
                });
            };
            return (
                <div onDragOver={stopEvent} onDrop={stopEvent}>
                    <img ref="help" src="/static/ide/img/help.png" className="field-help" data-original-title=""/>
                    {!!this.props.error && <Error {...this.props.error} />}
                    <h2>{gettext('Screenshots')}</h2>

                    <div className="monkey-platforms">
                        {this.props.platforms.map((platform)=>(
                        <PlatformTitle key={platform} platform={platform}/>
                            ))}
                    </div>

                    <ScreenshotForm screenshots={this.props.screenshots} platforms={this.props.platforms}
                                    disabled={this.props.loading}/>

                    {this.props.loading && <ProgressView />}

                    <div className="monkey-form-buttons">
                        <button className="btn btn-affirmative" type="submit"
                                form="monkey-form">{gettext('Save')}</button>
                        <button className="btn btn-cancel" onClick={onCancel}>{gettext('Reset')}</button>
                    </div>
                </div>
            );
        }
    });

    /** ScreenshotManagerContainer listens to changes in screenshot model, and passes them to the UI */
    var ScreenshotManagerContainer = React.createClass({
        getInitialState: function() {
            return {
                screenshots: [],
                error: null,
                loading: false,
                platforms: Platforms.initial()
            }
        },
        componentDidMount: function() {
            this.listener = _.extend({}, Backbone.Events);
            // If we get a 'changed' or 'error' event, we know that loading is done.
            this.listener.listenTo(Platforms, 'changed', (state)=>this.setState(state));
            this.listener.listenTo(Screenshots, 'changed', (screenshots)=>this.setState({
                screenshots: screenshots,
                error: null,
                loading: false
            }));
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
            var elm = React.createElement(ScreenshotManagerContainer, props);
            ReactDOM.render(elm, element);
        }
    }
});
