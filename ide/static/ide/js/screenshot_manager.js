CloudPebble.MonkeyScreenshots = (function() {
    var current_platforms = ['aplite', 'basalt', 'chalk'];
    var screenshot_editor_template;

    function ScreenshotFile(options) {
        var options = _.defaults(options || {}, {
            is_new: false,
            id: null,
            file: null,
            src: ""
        });
        this.is_new = options.is_new;
        this.id = options.id;
        this.file = options.file;
        this.src = options.src;
    }

    /**
     * A mock API (for now)
     * @type {{get_screenshots}}
     */
    var MockAPI = function() {
        var screenshots = [{
            name: "Screenshot set 1",
            id: 0,
            images: {
                aplite: new ScreenshotFile({src: "/static/common/img/screenshot-aplite.png", id: 0}),
                basalt: new ScreenshotFile({src: "/static/common/img/screenshot-basalt.png", id: 1}),
                chalk:  new ScreenshotFile({src: "/static/common/img/screenshot-chalk.png",  id: 2})
            }
        }, {
            name: "Screenshot set 2",
            id: 1,
            images: {
                aplite: new ScreenshotFile({src: "/static/common/img/screenshot-aplite.png", id: 3}),
                basalt: new ScreenshotFile({src: "/static/common/img/screenshot-basalt.png", id: 4}),
                chalk:  new ScreenshotFile({src: "/static/common/img/screenshot-chalk.png",  id: 5})
            }
        }];

        /**
         * Put screenshot data in a format ready to be sent.
         * @param screenshots
         * @returns {{screenshots: Array, files: Array}}
         */
        var process_screenshots = function(screenshots) {
            var screenshots_data = [];
            var files = [];
            _.each(screenshots, function(screenshot) {
                var shot_data = {name: screenshot.name, id: screenshot.id};
                _.each(screenshot.images, function(image, platform) {
                    shot_data[platform] = {id: image.id};
                    if (image.file !== null) {
                        shot_data[platform].uploadId = files.length;
                        files.push(image.file);
                    }
                }, this);
                screenshots_data.push(shot_data);
            }, this);
            return {
                screenshots: screenshots_data,
                files: files
            }
        };

        /**
         * Get the current list of existing test screenshots
         * @param test_name name of test
         * @returns {jQuery.Deferred}
         */
        this.getScreenshots = function(test_name) {
            var defer = $.Deferred();
            setTimeout(function () {
                defer.resolve(_.map(screenshots, _.clone));
            }, 700);
            return defer.promise();
        };

        /**
         * Save the current state of the screenshots
         * @param test_name name of test
         * @param new_screenshots
         * @returns {*}
         */
        this.saveScreenshots = function(test_name, new_screenshots) {
            var defer = $.Deferred();
            var data = process_screenshots(new_screenshots);
            var form_data = new FormData();
            var screenshot_json = JSON.stringify(data.screenshots);
            form_data.append('screenshots', screenshot_json);
            _.each(data.files, function(file) {
                form_data.append('files[]', file);
            });

            // Made the form data, now we just have to send it.

            setTimeout(function() {
                // TODO: AJAX request
                screenshots = _.map(new_screenshots, function(shot) {
                    var new_shot = _.clone(shot);
                    new_shot.images = _.mapObject(_.clone(new_shot.images), _.partial(_.extend, _, {is_new: false, file: null}));
                    new_shot._changed = false;
                    return new_shot;
                });
                defer.resolve();
            }, 700);
            return defer.promise();
        };
    };

    var API = new MockAPI();

    /**
     * ScreenshotsModel manages a list of new screenshot files to be uploaded
     * @fires ScreenshotsModel.change when files are added or modified
     * @constructor
     */
    function ScreenshotsModel(test_name) {
        var self = this;
        var screenshots = [];
        var original_screenshots = [];
        _.extend(this, Backbone.Events);

        /**
         * Update the list of screenshots to be uploaded with some new files. If multiple files are added at one index,
         * each file[i] is added to the screenshot[index+i]
         * @param files an Array of File objects
         * @param index the screenshot index to update, or null for new screenshots
         * @param platform a string naming the platform for all of the new screenshots
         */
        this.addUploadedFiles = function(files, index, platform) {
            if (index === null) {
                // Append all new screenshots, given them no name
                _.each(files, function(file) {
                    var upload = {
                        name: "",
                        images: {},
                        _changed: true
                    };
                    upload.images[platform] = new ScreenshotFile({file: file, is_new: true});
                    screenshots.push(upload);
                });
            }
            else {
                _.each(files, function(file, i) {
                    var upload = screenshots[index + i];
                    if (upload) {
                        // Update existing screenshots at the current index
                        var id = (upload.images[platform] ? upload.images[platform].id : null);
                        upload.images[platform] = new ScreenshotFile({file:file, id: id, is_new: true});
                    }
                    else {
                        // If there was no screenshot to update, add the remaining files as new screenshots.
                        this.addUploadedFiles(files.slice(i), null, platform);
                    }
                }, this);
            }
            this.trigger('changeScreenshots', screenshots);
        };

        /**
         * ScreenshotsModel stores the currently uploaded screenshots
         * @constructor
         */
        this.loadScreenshots = function() {
            API.getScreenshots(test_name).then(function(result) {
                screenshots = result;
                original_screenshots = _.map(result, _.clone);
                self.trigger('changeScreenshots', result);
            }, function() {
                self.trigger('error', gettext("Error getting screenshots"));
            })
        };

        /**
         * Set the screenshot names for each new upload.
         * @param names Array of names to apply to each upload
         */
        this.setNames = function(names) {
            _.each(names, function(name, idx) {
                this.setName(idx, name);
            }, this);
        };

        this.setName = function(index, name) {
            if (_.isString(name)) {
                var changed = (!(_.has(original_screenshots, index)) || (name != original_screenshots[index].name));
                screenshots[index].name = name;
                screenshots[index]._changed = changed;
                self.trigger('changeName', index, name, changed);
            }
        };

        this.save = function() {
            API.saveScreenshots(test_name, screenshots).then(function() {
                console.log("saved1");
                self.trigger('saved');
            }, function() {
                // Error?
            });
        };
    }

    /**
     * Manages a user interface for uploading new screenshots
     * @param pane to render the user interface in
     * @fires ScreenshotsView.filesSelected when a user tries to upload new files
     * @constructor
     */
    function ScreenshotsView(pane) {
        var self = this;
        var screenshot_set_template = pane.find('.monkey-screenshot-set').detach().removeClass('hide');
        var img_selector = '.image-resource-preview img';
        var file_selector = 'input[type="file"]';

        _.extend(this, Backbone.Events);

        var selected_files = function(files, elm) {
            var row = $(elm).parents('.monkey-screenshot-set');
            var col = $(elm).parents('.image-resource-preview');
            self.trigger('filesSelected', files, row.data('index'), col.data('platform'));
        };

        // Enable drag and drop uploads
        pane.on('dragover', img_selector, function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('dragenter', img_selector, function(e) {
            $(this).addClass('monkey-hover');
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('dragleave', img_selector, function(e) {
            $(this).removeClass('monkey-hover');
            e.preventDefault();
            e.stopPropagation();
        });
        pane.on('drop', img_selector, function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('monkey-hover');
            var files = e.originalEvent.dataTransfer.files;
            selected_files(files, this);
        });
        // Or, upload files by clicking
        pane.on('click', img_selector, function(e) {
            $(this).siblings('input').click();
            e.stopPropagation();
            e.preventDefault();
        });
        pane.on('change', file_selector, function(e) {
            var files = e.target.files;
            selected_files(files, this);
        });
        pane.on('input', 'input[type="text"]', function(e) {
            var index = $(this).parents('.monkey-screenshot-set').data('index');
            var value = $(this).val();
            self.trigger('inputName', index, value);
        });
        /*
         * Render the list of screenshots
         * @param screenshots
         */
        this.renderScreenshots = function(screenshots) {
            pane.empty();
            _.each(screenshots, function(screenshot, index) {
                var template = screenshot_set_template.clone();
                template.find('.monkey-screenshot-name').text(screenshot.name);

                _.each(screenshot.images, function(file, platform) {
                    var img = template.find('.platform-'+platform+' img');
                    if (file.src) {
                        img.attr('src', file.src);
                    }
                    else if (file.file) {
                        var reader = new FileReader();
                        // TODO: loading image
                        reader.onload = function() {
                            img.attr('src', reader.result);
                            file.src = reader.result;
                        };
                        reader.readAsDataURL(file.file);
                    }
                    img.toggleClass('monkey-modified', file.is_new);
                });
                template.find('.monkey-screenshot-title').removeClass('hide');
                template.find('.monkey-screenshot-title input').val(screenshot.name);
                template.find('.monkey-changed').toggleClass('hide', !screenshot._changed);
                template.data('index', index);
                pane.append(template);
            });
            var new_screenshot_pane = screenshot_set_template.clone();
            new_screenshot_pane.data('index', null);
            new_screenshot_pane.find('.monkey-screenshot-title').remove();
            pane.append(new_screenshot_pane)
        };

        this.showAsChanged = function(index, changed) {
            pane.find('.monkey-screenshot-set').filter(function() {
                return $(this).data('index') == index;
            }).find('.monkey-changed').toggleClass('hide', !changed);
        };

        this.getNames = function() {
            var names = [];
            pane.find('.monkey-screenshot-set').each(function() {
                var idx = $(this).data('index');
                if (idx !== null) {
                    names[$(this).data('index')] = $(this).find('.monkey-screenshot-title input').val();
                }
            });
            return names;
        };

        /**
         * Render an error
         * @param error message to render
         */
        this.renderError = function(error) {
            pane.html(interpolate('<div class="well alert alert-error">%s</div>', [error]));
        };
    }

    /**
     * This class manages the save and reset buttons
     * @param pane
     * @constructor
     */
    function FormButtonsView(pane) {
        var self = this;
        _.extend(this, Backbone.Events);

        pane.on('click', '.btn-cancel', function() {
            CloudPebble.Prompts.Confirm(gettext("Reset all changes?"), gettext("This cannot be undone."), function() {
                self.trigger('reset');
            });
        });

        pane.on('click', '.btn-affirmative', function() {
            self.trigger('save');
        });
    }

    function ScreenshotPane(test_name) {
            var pane = screenshot_editor_template.clone();
            var screenshots;
            var screenshots_view;
            var buttons_view;
            /**
             * Set up the screenshot manager in a pane, and connect models to views.
             * @param test_name name of test associated with screenshots
             * @param pane HTML element containing monkey screenshot uploader
             */
            function setup_pane(test_name, pane) {
                screenshots = new ScreenshotsModel(test_name);
                screenshots_view = new ScreenshotsView(pane.find('.monkey-screenshots'));
                buttons_view = new FormButtonsView(pane.find('.monkey-form-buttons'));
                // Render screenshots whenever we fetch them
                screenshots.on('changeScreenshots', function(screenshots) {
                    screenshots_view.renderScreenshots(screenshots);
                }).on('error', function(error) {
                    screenshots_view.renderError(error);
                }).on('changeName', function(index, name, changed) {
                    screenshots_view.showAsChanged(index, changed);
                }).on('saved', function() {
                    console.log("loading");
                    screenshots.loadScreenshots();
                });

                // Update list of uploads when user selects files
                screenshots_view.on('filesSelected', function(fileList, index, platform) {
                    screenshots.setNames(screenshots_view.getNames());
                    var files = [];
                    _.each(fileList, function(file, i) {
                        files[i] = file;
                    });
                    screenshots.addUploadedFiles(files, index, platform);
                });
                screenshots_view.on('inputName', function(index, value) {
                    screenshots.setName(index, value);
                });

                // Perform actions when form buttons are clicked
                buttons_view.on('reset', function() {
                    screenshots.loadScreenshots();
                });
                buttons_view.on('save', function() {
                    screenshots.setNames(screenshots_view.getNames());
                    screenshots.save();
                });

                screenshots_view.renderScreenshots([]);
                screenshots.loadScreenshots();
            }

            setup_pane(test_name, pane);
            this.getPane = function() {
                return pane;
            };
            this.destroy = function() {
                // TODO: what else should we destroy?
                pane.trigger('destroy');
            }
    }

    //setup_pane("TEST", $('.monkey-pane'));

    return {
        Init: function() {
            screenshot_editor_template = $('#monkey-screenshot-manager-template').detach().removeClass('hide');
        },
        ScreenshotPane: ScreenshotPane
    }
})();