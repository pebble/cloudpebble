CloudPebble.MonkeyScreenshots = (function() {

    /** A simple class with default values for Screenshot files */
    function ScreenshotFile(options) {
        var final = _.defaults(options || {}, {
            is_new: false,
            id: null,
            file: null,
            src: "",
            _changed: false
        });
        this.is_new = final.is_new;
        this.id = final.id;
        this.file = final.file;
        this.src = final.src;
        if (this.src.startsWith('/')) {
            this.src = interpolate("%s?%s", [this.src, (new Date().getTime())]);
        }
        this._changed = final._changed;
    }

    /** A simple class with default values for screenshot sets,
     * which makes ScreenshotFile instances of its children if it needs to.*/
    function ScreenshotSet(options) {
        var final = _.defaults(options || {}, {
            name: "",
            id: null,
            files: []
        });
        this.name = final.name;
        this.id = final.id;
        this.files = _.mapObject(final.files, function (file) {
            return ((file instanceof ScreenshotFile) ? file : new ScreenshotFile(file));
        });
    }

    /**
     * Put screenshot data in a format ready to be sent.
     * @param screenshots
     * @returns {{screenshots: Array, files: Array}}
     */
    var process_screenshots = function(screenshots) {
        var screenshots_data = [];
        var files = [];
        _.each(screenshots, function(screenshot) {
            var shot_data = {name: screenshot.name, files: {}};
            if (screenshot.id) {shot_data.id = screenshot.id;}
            _.each(screenshot.files, function(image, platform) {
                if (image.id || image.file) {
                    shot_data.files[platform] = {};
                    if (image.id) {shot_data.files[platform].id = image.id;}
                    if (image.file !== null) {
                        shot_data.files[platform].uploadId = files.length;
                        files.push(image.file);
                    }
                }
            }, this);
            if (_.keys(shot_data.files).length > 0)
                screenshots_data.push(shot_data);
        }, this);

        var form_data = new FormData();
        form_data.append('screenshots', JSON.stringify(screenshots_data));
        _.each(files, function(file) {
            form_data.append('files[]', file);
        });

        return form_data;
    };

    /** The screenshots API, gets from and saves to the Django backend */
    var AjaxAPI = function() {
        this.getScreenshots = function(test_id) {
            var url = "/ide/project/" + PROJECT_ID + "/test/" + test_id + "/screenshots/load";
            return $.ajax({
                url: url,
                dataType: 'json'
            }).then(function(result) {
                return _.map(result['screenshots'], function(screenshot_set) {
                    return new ScreenshotSet(screenshot_set);
                })
            });
        };

        this.saveScreenshots = function(test_id, new_screenshots) {
            var form_data = process_screenshots(new_screenshots);
            var url = "/ide/project/" + PROJECT_ID + "/test/" + test_id + "/screenshots/save";
            return $.ajax({
                url: url,
                type: "POST",
                data: form_data,
                processData: false,
                contentType: false,
                dataType: 'json'
            });

        }
    };

    var take_screenshot = function(kind) {


        /** Convert a data URI to a Blob so it can be uploaded normally
         * http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata
         */
        function dataURItoBlob(dataURI) {
            // convert base64/URLEncoded data component to raw binary data held in a string
            var byteString;
            if (dataURI.split(',')[0].indexOf('base64') >= 0)
                byteString = atob(dataURI.split(',')[1]);
            else
                byteString = unescape(dataURI.split(',')[1]);

            // separate out the mime component
            var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

            // write the bytes of the string to a typed array
            var ia = new Uint8Array(byteString.length);
            for (var i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }

            return new Blob([ia], {type:mimeString});
        }

        var defer = $.Deferred();
        SharedPebble.getPebble(kind).done(function(pebble) {
            var disconnect = function() {
                if(!SharedPebble.isVirtual()) {
                    SharedPebble.disconnect()
                }
            };

            pebble.on('close', function() {
                defer.reject(gettext("Disconnected from phone."));
            });

            pebble.on('screenshot:failed', function(reason) {
                CloudPebble.Analytics.addEvent('monkey_app_screenshot_failed', {virtual: SharedPebble.isVirtual()});
                defer.reject("Screenshot failed: " + reason);
                disconnect();
            });

            pebble.on('screenshot:progress', function(received, expected) {
                defer.notify(((received / expected) * 100));
            });

            pebble.on('screenshot:complete', function(screenshot) {
                var src = screenshot.src;
                var blob = dataURItoBlob(screenshot.src);
                defer.resolve(src, blob);
                disconnect();
                CloudPebble.Analytics.addEvent('monkey_app_screenshot_succeeded', {virtual: SharedPebble.isVirtual()});
            });

            pebble.request_screenshot();
        });
        return defer.promise();
    };

    var API = new AjaxAPI();

    /**
     * ScreenshotsModel manages a list of new screenshot files to be uploaded
     * @fires ScreenshotsModel.change when files are added or modified
     * @constructor
     */
    function ScreenshotsModel(test_name) {
        var self = this;
        var screenshots = [];
        var original_screenshots = [];
        var disabled = false;
        var progress = {};
        _.extend(this, Backbone.Events);

        this.getScreenshots = function() {
            return _.clone(screenshots);
        };

        /**
         * Update the list of screenshots to be uploaded with some new files. If multiple files are added at one index,
         * each file[i] is added to the screenshot[index+i]
         * @param files an Array of File objects
         * @param index the screenshot index to update, or null for new screenshots
         * @param platform a string naming the platform for all of the new screenshots
         */
        this.addUploadedFiles = function(files, index, platform) {
            if (disabled) return;
            var onloads = [];
            if (!_.every(files, function(file) {
                    return (file.type == 'image/png');
                })) {
                this.trigger('error', {errorFor: gettext('add files'), text: 'screenshots must be PNG files.'})
                return;
            }
            var loadFile = function(screenshotfile) {
                var reader = new FileReader();
                var defer = $.Deferred();
                reader.onload = function() {
                    screenshotfile.src = reader.result;
                    defer.resolve();
                };
                onloads.push(defer.promise());
                reader.readAsDataURL(screenshotfile.file);
            };

            if (index === null) {
                // Append all new screenshots, given them no name
                _.each(files, function(file) {
                    var upload = new ScreenshotSet({_changed: true});
                    upload.files[platform] = new ScreenshotFile({file: file, is_new: true});
                    screenshots.push(upload);
                    loadFile(upload.files[platform]);
                });
            }
            else {
                _.each(files, function(file, i) {
                    var upload = screenshots[index + i];
                    if (upload) {
                        // Update existing screenshots at the current index
                        var id = (upload.files[platform] ? upload.files[platform].id : null);
                        upload.files[platform] = new ScreenshotFile({file:file, id: id, is_new: true});
                        loadFile(upload.files[platform]);
                    }
                    else {
                        // If there was no screenshot to update, add the remaining files as new screenshots.
                        this.addUploadedFiles(files.slice(i), null, platform);
                    }
                }, this);
            }
            $.when.apply(this, onloads).then(function() {
                self.trigger('changed', screenshots);
            });
        };

        var set_progress = function(index, platform, percent) {
            var prog_obj = {};
            prog_obj[index] = {};
            prog_obj[index][platform] = percent;
            _.defaults(progress, prog_obj);
            _.extend(progress[index], prog_obj[index]);
            self.trigger('progress', progress);
        };

        var clear_progress = function(index, platform) {
            if (_.isObject(progress[index])) {
                progress[index] = _.omit(progress[index], platform);
                if (_.keys(progress[index]).length == 0) {
                    delete progress[index];
                }
            }
            self.trigger('progress', progress);
        };

        var set_disabled = function(new_disabled) {
            disabled = new_disabled;
            self.trigger(disabled ? 'disable' : 'enable');
        };

        this.takeScreenshot = function(index, platform) {
            if (disabled) return;
            set_disabled(true);
            set_progress(index, platform, 0);
            take_screenshot().done(function (src, blob) {
                var options = {file: blob, src: src, is_new: true};
                var screenshot_set;
                if (index === null) {
                    screenshot_set = new ScreenshotSet({_changed: true});
                    screenshot_set.files[platform] = new ScreenshotFile(options);
                    screenshots.push(screenshot_set);
                }
                else {
                    screenshot_set = screenshots[index];
                    var id = (screenshot_set.files[platform] ? screenshot_set.files[platform].id : null);
                    options[id] = id;
                    screenshot_set.files[platform] = new ScreenshotFile(options);
                }
                self.trigger('changed', screenshots);
            }.bind(this)).fail(function (error) {
                self.trigger('error', {text: error, errorFor: gettext("take screenshot")});
            }.bind(this)).progress(function (percentage) {
                set_progress(index, platform, percentage);
            }).always(function () {
                clear_progress(index, platform);
                set_disabled(false);
            });
        };

        /**
         * ScreenshotsModel stores the currently uploaded screenshots
         * @constructor
         */
        this.loadScreenshots = function() {
            var timeout = setTimeout(function() {
                self.trigger('waiting');
            }, 500);
            API.getScreenshots(test_name).then(function(result) {
                screenshots = result;
                original_screenshots = _.map(result, _.clone);
                self.trigger('changed', result);
            }, function(error) {
                self.trigger('error', {text: gettext("Error getting screenshots")});
                console.log(error);
            }).always(function() {
                clearTimeout(timeout);
            });
        };

        this.deleteFile = function(index, platform) {
            if (disabled) return;
            if (_.isObject(screenshots[index].files[platform])) {
                screenshots[index].files[platform] = {is_new: true};
                this.trigger('changed', screenshots);
            }
        };

        this.setName = function(index, name) {
            if (disabled) return;
            if (_.isString(name)) {
                var changed = (!(_.has(original_screenshots, index)) || (name != original_screenshots[index].name));
                screenshots[index].name = name;
                screenshots[index]._changed = changed;
                self.trigger('changed', screenshots);
            }
        };

        this.save = function() {
            if (disabled) return;
            set_disabled(true);
            var timeout = setTimeout(function() {
                self.trigger('waiting');
            }, 500);
            API.saveScreenshots(test_name, screenshots).then(function(result) {
                if (result.success == false) {
                    self.trigger('error', {errorFor: gettext('save screenshots'), text: result.error});
                }
                else {
                    self.trigger('saved', true);
                    self.loadScreenshots();
                }
            }, function(jqXHR, textStatus, errorThrown) {
                self.trigger('error', {text: jqXHR.responseText, textStatus: textStatus, errorThrown: errorThrown, errorFor: gettext('save screenshots')});
            }).always(function() {
                set_disabled(false);
                clearTimeout(timeout);
            });
        };
    }

    /** This class keeps track of which platform is currently selected, and also
     * interacts with the SidePane */
    function UIState(pane) {
        // TODO: fetch this from somewhere more global
        var supported_platforms = ['aplite', 'basalt', 'chalk'];
        var single = false;
        _.extend(this, Backbone.Events);
        this.toggle = function(platform) {
            single = (single ? false : platform);
            var platforms = (single ? [single] : supported_platforms)
            this.trigger('changed', {
                platforms: platforms
            });
            // When the user clicks a platform title, this causes the SidePane to resize appropriately.
            $(pane).innerWidth(this.getSize());
            pane.trigger('resize', this.getSize());
        };

        this.initial = function() {
            return _.clone(supported_platforms);
        };

        this.getSize = function() {
            var platforms = (single ? [single] : supported_platforms)
            return (30+platforms.length*200)+"px";
        };
        // Set the initial size of the side pane.
        $(pane).width(this.getSize());
    }


    /**
     * This sets up a screenshot editor pane
     * @param test_name Name of test for this ScreenshotPane
     * @constructor
     */
    function ScreenshotPane(test_name) {
        var pane = $('<div>').toggleClass('monkey-pane');
        var uiState, screenshots, view;

        _.extend(this, Backbone.Events);
        // Set up the data/models and pass them to the UI.
        uiState = new UIState(pane);
        screenshots = new ScreenshotsModel(test_name);
        view = CloudPebble.MonkeyScreenshots.Interface(screenshots, uiState);
        view.render(pane.get()[0], {});

        /** Get the actual pane so it can be attached to an object */
        this.getPane = function() {
            return pane;
        };

        /** Destroy the contents of the pane */
        this.destroy = function() {
            pane.trigger('destroy');
            pane.empty();
            view = pane = screenshots = uiState = null;
        };

        this.getScreenshots = function() {
            return screenshots.getScreenshots();
        }
    }

    return {
        ScreenshotPane: ScreenshotPane
    }
})();
