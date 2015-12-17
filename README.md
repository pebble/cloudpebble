CloudPebble
===========

CloudPebble is a web-based IDE for Pebble development. Email [cloudpebble@getpebble.com][support] for questions or
support.

Getting Started
---------------

The easiest way to get a fully-functional copy of CloudPebble is using Docker and Docker Compose. Instructions can
be found in the [https://github.com/pebble/cloudpebble-composed](cloudpebble-composed) repo.


To locally override the configuration, you can create a file at `cloudpebble/settings_local.py` and set the
appropriate values there. Setting environment variables also works.

Note that you won't be able to set up integration with certain Pebble systems (e.g. Pebble SSO). This shouldn't usually
matter; whenever these are used, an alternative route is provided and should be invoked in its absence.

Contributing
------------

Fork the repo, create a branch, do your work, and make a pull request. Multiple commits are fine, provided they make
logical sense. Please avoid commits that fix typos in prior commits.

If a change is a significant amount of work, it would probably be worth creating an issue to discuss it first. Pull
requests are not automatically accepted (though they usually are).

[support]: mailto:cloudpebble@getpebble.com
