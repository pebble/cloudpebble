from fabric.api import *
from fabric.contrib.console import confirm

env.hosts = ['app.cloudpebble.net']
env.project_root = '/home/cloudpebble/web/cloudpebble'
env.virtualenv = '/home/cloudpebble/virtualenv'
env.app_user = 'cloudpebble'


def check_updated():
    local("git status")
    if not confirm("Are you ready to deploy?"):
        abort("Not ready.")


def update_remote():
    with cd(env.project_root), settings(sudo_user=env.app_user):
        sudo("git pull")


def update_django():
    with cd(env.project_root), settings(sudo_user=env.app_user):
        with prefix(". %s/bin/activate" % env.virtualenv):
            sudo("python manage.py syncdb")
            sudo("python manage.py migrate")
            sudo("python manage.py collectstatic --noinput")


def update_modules():
    with cd(env.project_root), settings(sudo_user=env.app_user):
        with prefix(". %s/bin/activate" % env.virtualenv):
            sudo("pip install -q --exists-action i -r requirements.txt")


def restart_servers():
    sudo("supervisorctl restart cloudpebble cloudpebble_celery")


def deploy():
    check_updated()
    update_remote()
    update_modules()
    update_django()

    restart_servers()
