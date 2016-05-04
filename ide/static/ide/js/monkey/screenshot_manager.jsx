CloudPebble.MonkeyScreenshots = (function() {

    /**
     * Put screenshot data in a format ready to be sent.
     * @param screenshots
     * @returns {{screenshots: Array, files: Array}}
     */
    function process_screenshots(screenshots) {
        const screenshots_data = [];
        const files = [];
        _.each(screenshots, (screenshot) => {
            const shot_data = {name: screenshot.name, files: {}};
            if (screenshot.id) {
                shot_data.id = screenshot.id;
            }
            _.each(screenshot.files, (image, platform) => {
                if (image.id || image.file) {
                    shot_data.files[platform] = {};
                    if (image.id) {
                        shot_data.files[platform].id = image.id;
                    }
                    if (image.file !== null) {
                        shot_data.files[platform].uploadId = files.length;
                        files.push(image.file);
                    }
                }
            });
            if (_.keys(shot_data.files).length > 0)
                screenshots_data.push(shot_data);
        });

        const form_data = new FormData();
        form_data.append('screenshots', JSON.stringify(screenshots_data));
        _.each(files, (file) => {
            form_data.append('files[]', file);
        });

        return form_data;
    }

    /** Given a pebble object, request a screenshot from it
     * @param pebble{Pebble} Pebble to request a screenshot from
     * @param on_progress{Function} A callback to send progress to
     * @returns {Promise.<ScreenshotFile>} A promise which resolves with the new screenshot
     */
    function request_screenshot(pebble, on_progress) {
        const listener = _.extend({}, Backbone.Events);
        return (new Promise((resolve, reject) => {
            const disconnect_if_not_virtual = () => {
                if (!SharedPebble.isVirtual()) {
                    SharedPebble.disconnect()
                }
            };
            listener.listenTo(pebble, 'close', () => {
                reject(gettext("Disconnected from phone."));
            });

            listener.listenTo(pebble, 'screenshot:failed', (error) => {
                CloudPebble.Analytics.addEvent('monkey_app_screenshot_failed', {virtual: SharedPebble.isVirtual()});
                reject(new Error(`Screenshot failed: ${error.message}`));
                disconnect_if_not_virtual();
            });

            listener.listenTo(pebble, 'screenshot:progress', (received, expected) => {
                if (_.isFunction(on_progress)) {
                    on_progress((received / expected) * 100);
                }
            });

            listener.listenTo(pebble, 'screenshot:complete', (screenshot) => {
                const src = screenshot.src;
                const blob = CloudPebble.Utils.ConvertDataURItoBlob(screenshot.src);
                resolve(new ScreenshotFile({src, blob, is_new: true}));
                disconnect_if_not_virtual();
                CloudPebble.Analytics.addEvent('monkey_app_screenshot_succeeded', {virtual: SharedPebble.isVirtual()});
            });
            pebble.request_screenshot();
        })).finally(() => {
            listener.stopListening();
        });
    }

    /**
     * Get a pebble instance and take a screenshot from it
     * @param on_progress{Function} A callback to send progress to
     * @returns {Promise.<ScreenshotFile>} A promise which resolves with the new screenshot
     */
    function take_screenshot(on_progress) {
        SharedPebble.getPebble().then((pebble) => request_screenshot(pebble, on_progress));
    }

    /** A simple class with default values for Screenshot files */
    class ScreenshotFile {
        constructor(options) {
            const final = _.defaults(options || {}, {
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
                this.src = `${this.src}?${new Date().getTime()}`;
            }
            this._changed = final._changed;
        }
    }

    /** A simple class with default values for screenshot sets,
     * which makes ScreenshotFile instances of its children if it needs to.*/
    class ScreenshotSet {
        constructor(options) {
            const final = _.defaults(options || {}, {
                name: "",
                id: null,
                files: [],
                _changed: false
            });
            this._changed = final._changed;
            this.name = final.name;
            this.id = final.id;
            this.files = _.mapObject(final.files, (file) => (file instanceof ScreenshotFile) ? file : new ScreenshotFile(file));
        }

        hasChangedOrChildrenHaveChanged() {
            return this._changed || _.chain(this.files).map((file) => file._changed || file.is_new).any().value();
        }

        clone() {
            let clone = _.clone(this);
            clone.files = _.mapObject(this.files, _.clone);
            return clone;
        }
    }

    /** The screenshots API, gets from and saves to the Django backend */
    class AjaxAPI {
        static getScreenshots(test_id) {
            const url = `/ide/project/${PROJECT_ID}/test/${test_id}/screenshots/load`;
            return Ajax.Ajax({
                url,
                dataType: 'json'
            }).then((result) => _.map(result['screenshots'], (screenshot_set) => new ScreenshotSet(screenshot_set)));
        }

        static saveScreenshots(test_id, new_screenshots) {
            const form_data = process_screenshots(new_screenshots);
            const url = `/ide/project/${PROJECT_ID}/test/${test_id}/screenshots/save`;
            return Ajax.Ajax({
                url,
                type: "POST",
                data: form_data,
                processData: false,
                contentType: false,
                dataType: 'json'
            });

        }
    }

    /**
     * ScreenshotsModel manages a list of new screenshot files to be uploaded
     * @fires 'changed' when files are added or modified
     * @fires 'progress' to indicate screenshot progress
     * @fires 'disabled' when beginning a save/screenshot process
     * @fires 'enabled' when a saves/screenshot process is complete
     * @fires 'error' when there are errors
     * @fires 'saved' when the screenshot form is successfully submitted
     * @constructor
     */
    class ScreenshotsModel {
        constructor(test_id) {
            this.screenshots = [];
            this.original_screenshots = [];
            this.disabled = false;
            this.progress = {};
            this.test_id = test_id;
            _.extend(this, Backbone.Events);
        }

        getScreenshots() {
            return _.clone(this.screenshots);
        }

        /**
         * Update the list of screenshots to be uploaded with some new files. If multiple files are added at one index,
         * each file[i] is added to the screenshot[index+i]
         * @param files an Array of File objects
         * @param index the screenshot index to update, or null for new screenshots
         * @param platform a string naming the platform for all of the new screenshots
         */
        addUploadedFiles(files, index, platform) {
            if (this.disabled) return;
            const onloads = [];
            if (!_.every(files, (file) => file.type == 'image/png')) {
                this.trigger(
                    'error',
                    {errorFor: gettext('add files'), message: 'screenshots must be PNG files.'}
                );
                return;
            }
            const loadFile = screenshotfile => {
                const reader = new FileReader();
                const promise = new Promise((resolve) => {
                    reader.onload = () => {
                        screenshotfile.src = reader.result;
                        resolve();
                    };
                });
                onloads.push(promise);
                reader.readAsDataURL(screenshotfile.file);
            };

            if (index === null) {
                // Append all new screenshots, given them no name
                _.each(files, (file) => {
                    const upload = new ScreenshotSet({_changed: true});
                    upload.files[platform] = new ScreenshotFile({file, is_new: true});
                    this.screenshots.push(upload);
                    loadFile(upload.files[platform]);
                });
            }
            else {
                _.each(files, (file, i) => {
                    const upload = this.screenshots[index + i];
                    if (upload) {
                        // Update existing screenshots at the current index
                        const id = (upload.files[platform] ? upload.files[platform].id : null);
                        upload.files[platform] = new ScreenshotFile({file, id, is_new: true});
                        loadFile(upload.files[platform]);
                    }
                    else {
                        // If there was no screenshot to update, add the remaining files as new screenshots.
                        this.addUploadedFiles(files.slice(i), null, platform);
                    }
                });
            }
            Promise.all(onloads).then(() => {
                this.trigger('changed', this.screenshots);
            });
        }

        set_progress(index, platform, percent) {
            const prog_obj = {};
            prog_obj[index] = {};
            prog_obj[index][platform] = percent;
            _.defaults(this.progress, prog_obj);
            _.extend(this.progress[index], prog_obj[index]);
            this.trigger('progress', this.progress);
        };

        clear_progress(index, platform) {
            if (_.isObject(this.progress[index])) {
                this.progress[index] = _.omit(this.progress[index], platform);
                if (_.keys(this.progress[index]).length == 0) {
                    delete this.progress[index];
                }
            }
            this.trigger('progress', this.progress);
        }

        set_disabled(new_disabled) {
            this.disabled = new_disabled;
            this.trigger(this.disabled ? 'disable' : 'enable');
        }

        takeScreenshot(index, platform) {
            if (this.disabled) return;
            this.set_disabled(true);
            this.set_progress(index, platform, 0);
            return take_screenshot((percentage) => {
                this.set_progress(index, platform, percentage);
            }).then((screenshot) => {
                let screenshot_set;
                if (index === null) {
                    screenshot_set = new ScreenshotSet({_changed: true});
                    screenshot_set.files[platform] = screenshot;
                    this.screenshots.push(screenshot_set);
                }
                else {
                    screenshot_set = this.screenshots[index];
                    screenshot.id = screenshot_set.files[platform] ? screenshot_set.files[platform].id : null;
                    screenshot_set.files[platform] = screenshot;
                }
                this.trigger('changed', this.screenshots);
            }).catch((error) => {
                this.trigger('error', {message: error.toString(), errorFor: gettext("take screenshot")});
            }).always(() => {
                this.clear_progress(index, platform);
                this.set_disabled(false);
            });
        }

        /**
         * ScreenshotsModel stores the currently uploaded screenshots
         * @constructor
         */
        loadScreenshots() {
            const timeout = setTimeout(() => {
                this.trigger('waiting');
            }, 500);
            return AjaxAPI.getScreenshots(this.test_id).then((result) => {
                this.screenshots = result;
                this.original_screenshots = result.map((x) => x.clone());
                this.trigger('changed', result);
            }).catch((error) => {
                this.trigger('error', {message: error.message, errorfor: gettext('get screenshots')});
            }).finally(() => {
                clearTimeout(timeout);
            });
        }

        deleteFile(index, platform) {
            if (this.disabled) return;
            let screenshot_set = this.screenshots[index];
            let screenshot = screenshot_set.files[platform];
            if (_.isObject(screenshot)) {
                if (screenshot_set.id == null || !this.original_screenshots[index].files[platform]) {
                    delete screenshot_set.files[platform];
                }
                else {
                    screenshot_set.files[platform] = {is_new: true};
                }
                if (screenshot_set.id == null && _.keys(screenshot_set.files).length == 0) {
                    delete this.screenshots[index];
                }
                this.trigger('changed', this.screenshots);
            }
        }

        setName(index, name) {
            if (this.disabled) return;
            if (_.isString(name)) {
                const changed = (!(_.has(this.original_screenshots, index)) || (name != this.original_screenshots[index].name));
                this.screenshots[index].name = name;
                this.screenshots[index]._changed = changed;
                this.trigger('changed', this.screenshots);
            }
        }

        isModified() {
            return _.any(this.screenshots.map((screenshotSet) => screenshotSet.hasChangedOrChildrenHaveChanged()));
        }

        save() {
            if (this.disabled) return;
            this.set_disabled(true);
            const timeout = setTimeout(() => {
                this.trigger('waiting');
            }, 500);
            return AjaxAPI.saveScreenshots(this.test_id, this.screenshots).then((result) => {
                this.trigger('saved', true);
                return this.loadScreenshots();
            }).catch((error) => {
                this.trigger('error', {message: error.message, errorFor: gettext('save screenshots')});
            }).finally(() => {
                this.set_disabled(false);
                clearTimeout(timeout);
            });
        }
    }

    /** This class keeps track of which platform is currently selected, and also
     * interacts with the SidePane */
    class UIState {
        constructor(pane) {
            // TODO: fetch this from somewhere more global
            this.pane = pane;
            this.supported_platforms = ['aplite', 'basalt', 'chalk'];
            this.single = false;
            // Set the initial size of the side pane.
            $(pane).width(this.getSize()+'px');
            _.extend(this, Backbone.Events);
        }

        toggle(platform) {
            this.single = this.single ? false : platform;
            this.update();
        }

        update() {
            const platforms = (this.single ? [this.single] : this.supported_platforms);
            this.trigger('changed', {
                platforms
            });
            // When the user clicks a platform title, this causes the SidePane to resize appropriately.
            $(this.pane).innerWidth(this.getSize()+'px');
            this.pane.trigger('resize', this.getSize());
        }

        initial() {
            return _.clone(this.supported_platforms);
        }

        updateSupportedPlatforms() {
            return CloudPebble.Compile.GetPlatformsCompiledFor().then((platforms) => {
                if (platforms.length > 0) {
                    this.supported_platforms = platforms;
                    // Sorting platforms alphabetically is practically *and* technically correct
                    platforms.sort();
                }
                this.update();
            });

        }

        getSize() {
            const platforms = (this.single ? [this.single] : this.supported_platforms);
            return 30 + platforms.length * 200;
        }
    }


    /**
     * This sets up a screenshot editor pane
     * @param test_id ID of test for this ScreenshotPane
     * @constructor
     */
    class ScreenshotPane {
        constructor(test_id) {
            _.extend(this, Backbone.Events);
            this.test_id = test_id;
            this.pane = $('<div>').toggleClass('monkey-pane');
            this.uiState = new UIState(this.pane);
            this.screenshots = new ScreenshotsModel(test_id);
            this.view = null;

            Promise.all([this.screenshots.loadScreenshots(), this.uiState.updateSupportedPlatforms()]).then(() => {
                this.view = CloudPebble.MonkeyScreenshots.Interface(this.screenshots, this.uiState);
                this.view.render(this.pane.get()[0], {test_id});
            });

            this.pane.on('restored', () => {
                // This is triggered by the SidePane holder whenever the pane is restored
                this.screenshots.loadScreenshots();
                this.uiState.updateSupportedPlatforms();
            });
        }

        getPane() {
            return this.pane;
        }

        getScreenshots() {
            return this.screenshots.getScreenshots();
        }

        /** Destroy the contents of the pane */
        destroy() {
            this.pane.trigger('destroy');
            this.view = this.pane = this.screenshots = this.uiState = null;
        }
    }

    return {ScreenshotPane}
})();
