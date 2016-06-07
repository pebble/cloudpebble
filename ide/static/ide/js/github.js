CloudPebble.GitHub = (function() {
    var github_template = null;

    var create_repo = function(new_repo) {
        var prompt = $('#github-new-repo-prompt').modal();
        var repo_name = new_repo.match(/^(?:https?:\/\/|git@|git:\/\/)?(?:www\.)?github\.com[\/:]([\w.-]+)\/([\w.-]+?)(?:\.git|\/|$)/)[2];
        prompt.find('#github-new-repo').val(repo_name);
        prompt.find('.alert').removeClass('alert-error').addClass('alert-warning').text(gettext("That repo does not exist. Would you like to create it?"));
    };

    var show_github_pane = function() {
        if(!USER_SETTINGS.github) return;
        CloudPebble.Sidebar.SuspendActive();
        if(CloudPebble.Sidebar.Restore("github")) {
            return;
        }
        var pane = github_template.clone();
        var show_alert = function(type, message) {
            pane.find('.alert').removeClass('hide alert-error alert-warning alert-info alert-success').addClass('alert-' + type).text(message);
        };
        var clear_alert = function() {
            pane.find('.alert').addClass('hide');
        };
        var disable_all = function() {
            pane.find('input, button').attr('disabled', 'disabled');
        };
        var enable_all = function() {
            pane.find('input, button').removeAttr('disabled');
        };
        var disable_needy = function() {
            pane.find('.github-actions').find('input, button').attr('disabled', 'disabled');
        };
        var enable_needy = function() {
            pane.find('.github-actions').find('input, button').removeAttr('disabled');
        };

        pane.find('#github-repo-form').submit(function(e) {
            e.preventDefault();
            clear_alert();
            var new_repo = pane.find('#github-repo').val();
            var repo_branch = pane.find('#github-branch').val();
            var auto_pull = pane.find('#github-repo-hook').val() == '1';
            var auto_build = pane.find('#github-repo-build').val() == '1';

            if(repo_branch == null || repo_branch.length == 0) {
                repo_branch = "master";
            }

            if((new_repo === CloudPebble.ProjectInfo.github.repo || !new_repo && !CloudPebble.ProjectInfo.github.repo) &&
                (repo_branch === CloudPebble.ProjectInfo.github.branch || !repo_branch && !CloudPebble.ProjectInfo.github.branch) &&
                auto_pull === CloudPebble.ProjectInfo.github.auto_pull && auto_build === CloudPebble.ProjectInfo.github.auto_build) {
                show_alert('success', "Updated repo (nothing changed).");
                return;
            }
            disable_all();
            var data = {
                repo: new_repo,
                auto_pull: auto_pull ? '1' : '0',
                auto_build: auto_build ? '1' : '0',
                branch: repo_branch
            };
            Ajax.Post('/ide/project/' + PROJECT_ID + '/github/repo', data).then(function(data) {
                enable_all();
                if(data.updated) {
                    show_alert('success', gettext("Updated repo."));
                    CloudPebble.ProjectInfo.github.repo = new_repo;
                    CloudPebble.ProjectInfo.github.branch = repo_branch;
                    CloudPebble.ProjectInfo.github.auto_pull = auto_pull;
                    CloudPebble.ProjectInfo.github.auto_build = auto_build;
                    return;
                }
                if(!data.exists) {
                    disable_needy();
                    create_repo(new_repo);
                    return;
                }
                if(!data.access) {
                    throw new Error(gettext("You don't have access to that repository."));
                }
            }).catch(function(error) {
                enable_all();
                disable_needy();
                show_alert('error', error.message);
            });
        });

        pane.find('#github-repo').on('input', function() {
            var new_repo = $(this).val();
            if(new_repo !== CloudPebble.ProjectInfo.github.repo || !new_repo) {
                disable_needy();
            } else {
                disable_needy();
            }
        });
        if(CloudPebble.ProjectInfo.github.repo) {
            pane.find('#github-repo').val(CloudPebble.ProjectInfo.github.repo);
            enable_needy();
        }
        if(CloudPebble.ProjectInfo.github.branch) {
            pane.find('#github-branch').val(CloudPebble.ProjectInfo.github.branch);
        }
        pane.find('#github-repo-hook').val(CloudPebble.ProjectInfo.github.auto_pull ? '1' : '0');
        pane.find('#github-repo-build').val(CloudPebble.ProjectInfo.github.auto_build ? '1' : '0');

        var prompt = $('#github-new-repo-prompt');
        prompt.find('form').submit(function(e) {
            e.preventDefault();
            var new_repo = $('#github-new-repo').val();
            if(new_repo.replace(/\s/g, '') === '') {
                prompt.find('.alert').removeClass('alert-warning').addClass('alert-error').text(gettext("You must provide a repo URL."));
            }
            var description = $('#github-repo-description').val();
            prompt.find('input, button').prop('disabled', true);
            Ajax.Post('/ide/project/' + PROJECT_ID + '/github/repo/create', {repo: new_repo, description: description}).then(function(data) {
                pane.find('#github-repo').val(data.repo);
                CloudPebble.ProjectInfo.github.repo = new_repo;
                pane.find('#github-branch').val(data.branch);
                CloudPebble.ProjectInfo.github.branch = data.branch;
                prompt.modal('hide');
                enable_all();
            }).catch(function(error) {
                prompt.find('.alert').removeClass('alert-warning').addClass('alert-error').text(error);
            }).finally(function() {
                prompt.find('input, button').prop('disabled', false);
            });
        });
        pane.find('#github-push-btn').click(function() {
            $('#github-commit-prompt').modal().find('.alert, .progress').addClass('hide');
            $('#github-commit-prompt').find('input[type=text], textarea').val('');
            $('#github-commit-prompt').focus();
        });

        pane.find('#github-pull-btn').click(function() {
            var prompt = $('#github-pull-prompt').modal();
            prompt.find(".running").addClass('hide');
            prompt.find(".close, .dire-warning, .modal-footer").removeClass("hide");
        });

        var poll_commit_status = function(task_id) {
            return Ajax.PollTask(task_id).finally(function() {
                $('#github-commit-prompt').find('.progress').addClass('hide');
                $('#github-commit-prompt').modal('hide');
            }).then(function(result) {
                show_alert('success', result ? "Made new commit." : "Nothing to commit.");
                return result;
            }).catch(function(error) {
                show_alert('error', 'Error: ' + error.message);
                throw error;
            });
        };

        var poll_pull_status = function(task_id) {
            return Ajax.PollTask(task_id).then(function(result) {
                if(result) {
                    show_alert('success', gettext("Pulled successfully."));
                    alert(gettext("Pull completed successfully."));
                    // *NASTY HACK: Make sure it doesn't think we have unsaved files, thereby
                    // preventing page reload.
                    CloudPebble.Editor.GetUnsavedFiles = function() { return 0; };
                    window.location.reload(true);
                } else {
                    show_alert('success', gettext("Pull completed: Nothing to pull."));
                }
            });
        };

        $('#github-commit-prompt form').submit(function(e) {
            e.preventDefault();
            var commit_summary = $('#github-commit-summary').val();
            var commit_description = $('#github-commit-description').val();
            if(commit_summary.replace(/\s/g, '') === '') {
                $('#github-commit-prompt form').find('.alert').addClass('alert-error').removeClass('hide').text(gettext("You must provide a commit summary."));
                return;
            }
            var commit_message = commit_summary;
            if(commit_description !== '') {
                commit_message += "\n\n" + commit_description.replace("\r\n", "\n");
            }
            disable_all();
            $('#github-commit-prompt').find('input, textarea, button').attr('disabled', 'disabled');
            $('#github-commit-prompt').find('.progress').removeClass('hide');
            Ajax.Post('/ide/project/' + PROJECT_ID + '/github/commit', {commit_message: commit_message}).then(function(data) {
                return poll_commit_status(data.task_id);
            }).catch(function(error) {
                $('#github-commit-prompt form').find('.alert').addClass('alert-error').removeClass('hide').text(error);
            }).finally(function() {
                enable_all();
                $('#github-commit-prompt').find('input, textarea, button').removeAttr('disabled');
            });
            ga('send', 'event', 'github', 'push');
        });

        $('#github-pull-prompt-confirm').click(function() {
            disable_all();
            var prompt = $('#github-pull-prompt');
            prompt.find(".close, .dire-warning, .modal-footer").addClass("hide");
            prompt.find(".running").removeClass('hide');
            Ajax.Post('/ide/project/' + PROJECT_ID + '/github/pull').then(function(data) {
                return poll_pull_status(data.task_id);
            }).catch(function(error) {
                show_alert('error', interpolate(gettext("Pull failed: %s"), [error.message]));
            }).finally(function() {
                enable_all();
                prompt.modal('hide');
            });
            ga('send', 'event', 'github', 'pull');
        });

        CloudPebble.Sidebar.SetActivePane(pane, {id: 'github'});
    };

    return {
        Init: function() {
            github_template = $('#github-template').remove().removeClass('hide');
            if(!USER_SETTINGS.github) {
                $('#sidebar-pane-github').addClass('disabled');
                CloudPebble.Sidebar.SetPopover('github', '', gettext('GitHub integration can be enabled in your user settings by linking a GitHub account.'))
            }
        },
        Show: function() {
            show_github_pane();
        }
    };
})();
