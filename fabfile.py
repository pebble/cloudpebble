# WARNING: This file is extremely specific to how Katharine happens to have her 
# local machines set up.
# In particular, to run without modification, you will need:
# - An EC2 keypair in ~/Downloads/katharine-keypair.pem
# - A keypair for the ycmd servers in ~/.ssh/id_rsa
# - The tintin source tree in ~/projects/tintin
#   - With an appropriate python virtualenv in .env/
# - A clone of qemu-tintin-images in ~/projects/qemu-tintin-images
# - Access to the cloudpebble heroku app

from fabric.api import *
from fabric.tasks import execute
import os

PROJECTS_PATH = env.get('pebble_projects_path', '~/projects')


def get_project_path(name):
    return os.path.join(PROJECTS_PATH, name)


env.roledefs = {
    'qemu': ['ec2-user@qemu-us1.cloudpebble.net', 'ec2-user@qemu-us2.cloudpebble.net'],
    'ycmd': ['root@ycm1.cloudpebble.net', 'root@ycm2.cloudpebble.net',
             'root@ycm3.cloudpebble.net', 'root@ycm4.cloudpebble.net',],
}

# This needs to stay commented out for anyone except Katharine to use the script
# env.key_filename = ['~/.ssh/id_rsa', '~/Downloads/katharine-keypair.pem']


@task
@roles('qemu')
@parallel
def update_qemu_service():
    with cd("cloudpebble-qemu-controller"):
        run("git pull")
        run("git submodule update --init --recursive")
        with prefix(". .env/bin/activate"):
            run("pip install -r requirements.txt")
    sudo("restart cloudpebble-qemu")


@task
@roles('qemu')
@parallel
def update_qemu_sdk():
    with cd('qemu'):
        run("git pull")

        # This is currently the last qemu commit which works with CloudPebble
        run("git checkout 01b08e22cfc7c1e08d5087d669a5a2f4703d5a20")
        run("make -j8")

    with cd("qemu-tintin-images"):
        run("git pull")

    with cd("pypkjs"):
        run("git pull")
        run("git submodule update --init --recursive")
        with prefix(". .env/bin/activate"):
            run("pip install -r requirements.txt")


@task
@roles('qemu')
@parallel
def restart_qemu_service():
    sudo("restart cloudpebble-qemu")


@task
@roles('ycmd')
@parallel
def update_ycmd_sdk(sdk_version):
    with cd("/home/ycm"), settings(sudo_user="ycm", shell="/bin/bash -c"):
        sudo("wget -nv -O sdk.tar.gz https://s3.amazonaws.com/assets.getpebble.com/sdk3/release/sdk-core-%s.tar.bz2" % sdk_version)
        sudo("tar -xf sdk.tar.gz")
        sudo("rm -rf sdk3")
        sudo("mv sdk-core sdk3")


@task
@roles('ycmd')
@parallel
def update_ycmd_service():
    with cd("/home/ycm/proxy"), settings(sudo_user="ycm", shell="/bin/bash -c"):
        sudo("git pull")
        run("pip install --upgrade -r requirements.txt")
        run("restart ycmd-proxy")


@task
@roles('ycmd')
@parallel
def restart_ycmd_service():
    run("restart ycmd-proxy")


@task
def deploy_heroku():
    local("git push heroku master")


@task
def restart_heroku():
    local("heroku restart -a cloudpebble")


@task
def update_all_services():
    execute(update_qemu_service)
    execute(update_ycmd_service)
    execute(deploy_heroku)


@task
def restart_everything():
    execute(restart_qemu_service)
    execute(restart_ycmd_service)
    execute(restart_heroku)


def build_qemu_image(board, platform):
    with lcd(get_project_path("tintin")):
        with prefix(". .env/bin/activate"):
            local("python ./waf configure --board={} --qemu --release --sdkshell build qemu_image_spi qemu_image_micro".format(board))
        local("cp build/qemu_* {}".format(os.path.join(get_project_path('qemu-tintin-images'), platform, "3.0")))


@task
@runs_once
def update_qemu_images(sdk_version):
    # Merge conflicts are no fun.
    with lcd(get_project_path("qemu-tintin-images")):
        local("git pull")

    with lcd(get_project_path("tintin")):
        local("git checkout v%s" % sdk_version)

    # build_qemu_image("bb2", "aplite")
    build_qemu_image("snowy_bb2", "basalt")
    build_qemu_image("spalding_bb2", "chalk")
    build_qemu_image("silk_bb", "diorite")
    build_qemu_image("robert_bb", "emery")

    with lcd(get_project_path("qemu-tintin-images")):
        local("git commit -a -m 'Update to v%s'" % sdk_version)
        local("git push")


@task
@runs_once
def update_cloudpebble_sdk(sdk_version):
    local("sed -i.bak 's/sdk-core-3.[a-z0-9-]*\.tar\.bz2/sdk-core-%s.tar.bz2/' bin/post_compile bootstrap.sh" % sdk_version)
    local("git add bin/post_compile bootstrap.sh")
    local("git commit -m 'Update to v%s'" % sdk_version)
    local("git push")
    execute(deploy_heroku)


@task
def update_sdk(sdk_version):
    execute(update_qemu_images, sdk_version)
    execute(update_qemu_sdk)
    execute(update_ycmd_sdk, sdk_version)
    execute(update_cloudpebble_sdk, sdk_version)


@task
def update_all(sdk_version):
    execute(update_qemu_images, sdk_version)
    execute(update_qemu_sdk)
    execute(update_qemu_service)
    execute(update_ycmd_sdk, sdk_version)
    execute(update_ycmd_service)
    execute(update_cloudpebble_sdk, sdk_version)
