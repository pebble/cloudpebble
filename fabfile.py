from fabric.api import *
from fabric.contrib.console import confirm

env.hosts = ['pwdb.kathar.in']
env.project_root = '/home/cloudpebble/web/cloudpebble'
env.virtualenv = '/home/cloudpebble/cloudpebble'
env.app_user = 'cloudpebble'

def check_updated():
    local("git status")
    if not confirm("Are you ready to deploy?"):
        abort("Not ready.")

def deploy():
    check_updated()
    with cd(env.project_root), settings(sudo_user=env.app_user):
        # Update our code.
        sudo("git stash")
        with settings(warn_only=True):
            pulled = sudo("git pull").succeeded
        sudo("git stash pop")
        if not pulled:
            abort("git pull failed.")

        # Update stuff
        with prefix(". %s/bin/activate" % env.virtualenv):
            sudo("python manage.py syncdb")
            sudo("python manage.py migrate")
            sudo("python manage.py collectstatic --noinput")

    sudo("supervisorctl restart cloudpebble cloudpebble_celery")
