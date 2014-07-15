CloudPebble
===========

CloudPebble is a web-based IDE for Pebble development. Email [cloudpebble@getpebble.com][support] for questions or
support.

Getting Started
---------------

The easiest way to get an instance of CloudPebble running is to use [Vagrant][].
The supplied virtual machine assumes [VirtualBox][], so you'll want to have that installed too.
You will also need ports 8000 and 8001 to be available on your machine.

With those set up, just clone the repo and run `vagrant up`:

    host:~/cloudpebble$ vagrant up

After some waiting, you should have a functional instance running at [http://localhost:8000](http://localhost:8000).

In general, you can then stop it with `vagrant halt`, start it with `vagrant up`, and restart it with `vagrant reload`.
If you need to recreate the thing, you can use `vagrant destroy` and `vagrant up` again. No persistent data is stored
in the VM, so doing this is safe.

The server will be running in debug mode with autoreload enabled. However, the worker will not autoreload, so if you
make changes that the worker should pick up on, you must restart it manually:


    host:~/cloudpebble$ vagrant ssh
    vagrant@precise32:~$ sudo restart cloudpebble-celery


To locally override the configuration, create a file at `cloudpebble/settings_local.py` and set the appropriate values
there.

Note that you won't be able to set up integration with certain Pebble systems (e.g. Pebble SSO). This shouldn't usually
matter; whenever these are used, an alternative route is provided and should be invoked in its absence.

Contributing
------------

Fork the repo, create a branch, do your work, and make a pull request. Multiple commits are fine, provided they make
logical sense. Please avoid commits that fix typos in prior commits.

If a change is a significant amount of work, it would probably be worth creating an issue to discuss it first. Pull
requests are not automatically accepted (though they usually are).

[Vagrant]: http://www.vagrantup.com
[VirtualBox]: http://virtualbox.org
[support]: mailto:cloudpebble@getpebble.com
