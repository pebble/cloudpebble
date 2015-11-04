CloudPebble.MonkeyScreenshots = (function() {
    var current_platforms = ['aplite', 'basalt', 'chalk'];
    var screenshot_editor_template;

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
        this._changed = final._changed;
    }

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

    /**
     * A mock API (for now)
     * @type {{get_screenshots}}
     */
    var MockAPI = function() {
        var screenshots = [{
            name: "Screenshot set 1",
            id: 0,
            files: {
                aplite: new ScreenshotFile({src: "/static/common/img/screenshot-aplite.png", id: 0}),
                basalt: new ScreenshotFile({src: "/static/common/img/screenshot-basalt.png", id: 1}),
                chalk:  new ScreenshotFile({src: "/static/common/img/screenshot-chalk.png",  id: 2})
            }
        }, {
            name: "Screenshot set 2",
            id: 1,
            files: {
                aplite: new ScreenshotFile({src: "/static/common/img/screenshot-aplite.png", id: 3}),
                basalt: new ScreenshotFile({src: "/static/common/img/screenshot-basalt.png", id: 4}),
                chalk:  new ScreenshotFile({src: "/static/common/img/screenshot-chalk.png",  id: 5})
            }
        }];

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
            var form_data = process_screenshots(new_screenshots);

            // Made the form data, now we just have to send it.

            setTimeout(function() {
                screenshots = _.map(new_screenshots, function(shot) {
                    var new_shot = _.clone(shot);
                    new_shot.files = _.mapObject(_.clone(new_shot.files), _.partial(_.extend, _, {is_new: false, file: null}));
                    new_shot._changed = false;
                    return new_shot;
                });
                defer.resolve();
            }, 700);
            return defer.promise();
        };
    };

    var AjaxAPI = function() {
        this.getScreenshots = function(test_id) {
            var url = "/ide/project/" + PROJECT_ID + "/test/" + test_id + "/screenshots/load";
            var defer = $.Deferred();
            $.ajax({
                url: url,
                dataType: 'json'
            }).done(function(result) {
                defer.resolve(_.map(result['screenshots'], function(screenshot_set) {return new ScreenshotSet(screenshot_set)}));
            }).fail(function(err) {
                defer.reject(err);
            });
            return defer.promise();
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
                    var upload = new ScreenshotSet({
                        _changed: true
                    });
                    upload.files[platform] = new ScreenshotFile({file: file, is_new: true});
                    screenshots.push(upload);
                });
            }
            else {
                _.each(files, function(file, i) {
                    var upload = screenshots[index + i];
                    if (upload) {
                        // Update existing screenshots at the current index
                        var id = (upload.files[platform] ? upload.files[platform].id : null);
                        upload.files[platform] = new ScreenshotFile({file:file, id: id, is_new: true});
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
            this.trigger('loadStart');
            API.getScreenshots(test_name).then(function(result) {
                screenshots = result;
                original_screenshots = _.map(result, _.clone);
                self.trigger('changeScreenshots', result);
            }, function(error) {
                self.trigger('error', gettext("Error getting screenshots"));
                console.log(error);
            });
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

        this.deleteFile = function(index, platform) {
            if (_.isObject(screenshots[index].files[platform])) {
                screenshots[index].files[platform] = {_changed: true};
                this.trigger('changeScreenshots', screenshots);
            }
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
                self.trigger('saved', true);
            }, function(error) {
                self.trigger('error', gettext("Error saving screenshots"));
                console.error(error);
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
        pane.on('click', '.image-resource-preview .delete-btn', function() {
            var row = $(this).parents('.monkey-screenshot-set').data('index');
            var col = $(this).parents('.image-resource-preview').data('platform');
            self.trigger('fileDelete', row, col);
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

                _.each(screenshot.files, function(file, platform) {
                    var img_container = template.find('.platform-'+platform);
                    var img = img_container.find('img');
                    if (file.src) {
                        var src = file.src;
                        if (!src.startsWith('data')) {
                            src += '?'+(Date.now().toString());
                        }
                        img.attr('src', src);
                        img_container.toggleClass('screenshot-empty', false);
                    }
                    else if (file.file) {
                        var reader = new FileReader();
                        // TODO: loading image
                        reader.onload = function() {
                            img.attr('src', reader.result);
                            file.src = reader.result;
                        };
                        reader.readAsDataURL(file.file);
                        img_container.toggleClass('screenshot-empty', false);
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
            new_screenshot_pane.find('.monkey-screenshot-title, .delete-btn').remove();
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

        this.showProgress = function() {
            progressbar.show();
        };

        this.disable = function() {
            pane.find('input, button').prop('disabled', true);
        };

        this.enable = function() {
            pane.find('input').prop('disabled', false);
        };

    }

    function ErrorView(pane) {
        _.extend(this, Backbone.Events);
        /**
         * Render an error
         * @param error message to render
         */
        this.renderError = function(error) {
            pane.append($(interpolate('<div class="well alert alert-error">%s</div>', [error])));
        };

        this.empty = function() {
            pane.empty();
        }
    }

    /**
     * This class manages the save and reset buttons
     * @param pane jQuery element containing Save and Cancel buttons
     * @param form jQuery Form associated with the buttons
     * @constructor
     */
    function FormButtonsView(pane, form) {
        var self = this;
        _.extend(this, Backbone.Events);

        pane.on('click', '.btn-cancel', function() {
            CloudPebble.Prompts.Confirm(gettext("Reset all changes?"), gettext("This cannot be undone."), function() {
                self.trigger('reset');
            });
        });

        form.on('submit', function(event) {
            self.trigger('save');
            event.preventDefault();
        });
    }

    /**
     * Manages a progress bar, which only shows up if things are taking a while
     * @param pane HTML element contaiing a progress bar
     * @constructor
     */
    function ProgressView(pane) {
        var timeout;
        _.extend(this, Backbone.Events);
        pane.hide();
        this.showProgress = function() {
            timeout = setTimeout(function() {
                pane.show();
            }, 500);
        };

        this.hideProgress = function() {
            clearTimeout(timeout);
            pane.hide();
        }
    }

    /**
     * MainView manages the whole pane.
     * Specifically, it enables switching between aplite/basalt/chalk/all modes by clicking on their titles.
     * @param pane jQuery element for .monkey-pane
     * @constructor
     */
    function MainView(pane) {
        _.extend(this, Backbone.Events);
        pane.on('click', '.monkey-select-platform', function() {
            pane.toggleClass('monkey-inline');
            pane.toggleClass($(this).data('platform')+'-only');
            var newsize = (pane.hasClass('monkey-inline') ? '300px' : '650px');
            pane.trigger('resize', newsize);
        });
    }

    function ScreenshotPane(test_name) {
        var self = this;
        var pane = screenshot_editor_template.clone();
        var screenshots;
        var screenshots_view, buttons_view, progress_view, error_view, main_view;

        _.extend(this, Backbone.Events);

        /**
         * Set up the screenshot manager in a pane, and connect models to views.
         * @param test_name name of test associated with screenshots
         * @param pane HTML element containing monkey screenshot uploader
         */
        function setup_pane(test_name, pane) {
            screenshots = new ScreenshotsModel(test_name);
            screenshots_view = new ScreenshotsView(pane.find('.monkey-screenshots'));
            progress_view = new ProgressView(pane.find('.progress'));
            buttons_view = new FormButtonsView(pane.find('.monkey-form-buttons'), pane.find('form'));
            error_view = new ErrorView(pane.find('.errors'));
            main_view = new MainView(pane);

            screenshots.on('changeScreenshots', function(screenshots) {
                // Render screenshots whenever we fetch them
                error_view.empty();
                progress_view.hideProgress();
                screenshots_view.renderScreenshots(screenshots);
            }).on('error', function(error) {
                // Show an error if we fail to fetch them
                error_view.renderError(error);
                progress_view.hideProgress();
            }).on('changeName', function(index, name, changed) {
                // Show a "changed" icon if the name of a thing changes
                screenshots_view.showAsChanged(index, changed);
            }).on('saved', function() {
                // Reload the screenshots after a save
                error_view.empty();
                screenshots_view.enable();
                screenshots.loadScreenshots();

            }).on('loadStart', function() {
                progress_view.showProgress();
            });

            screenshots_view.on('filesSelected', function(fileList, index, platform) {
                // Update list of uploads when user selects files
                screenshots.setNames(screenshots_view.getNames());
                var files = [];
                _.each(fileList, function(file, i) {
                    files[i] = file;
                });
                screenshots.addUploadedFiles(files, index, platform);
            }).on('fileDelete', function(index, platform) {
                screenshots.deleteFile(index, platform);
            }).on('inputName', function(index, value) {
                // Update the screenshot's model's name when a user types in a name box
                screenshots.setName(index, value);
            });

            buttons_view.on('reset', function() {
                // Reload the screenshots when the reset button is clicked
                screenshots.loadScreenshots();
            });
            buttons_view.on('save', function() {
                // Save the screenshot when the save button is clicked
                // (ensure that the models names are up to date
                screenshots.setNames(screenshots_view.getNames());
                screenshots.save();
                screenshots_view.disable();
            });

            // When the component is initialised, render an intitial state and load all the screenshots
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
            _.each([screenshots, screenshots_view, buttons_view, progress_view, error_view, main_view], function(obj) {
                obj.off();
            });
        }
    }

    return {
        Init: function() {
            screenshot_editor_template = $('#monkey-screenshot-manager-template').detach().removeClass('hide');
        },
        ScreenshotPane: ScreenshotPane
    }
})();