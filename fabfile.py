# WARNING: This file is extremely specific to how Katharine happens to have her 
# local machines set up.
# In particular, to run without modification, you will need:
# - An EC2 keypair in ~/Downloads/katharine-keypair.pem
# - A keypair for the ycmd servers in ~/.ssh/id_rsa
# - The tintin source tree in ~/projects/tintin
#   - With an appropriate pypy virtualenv in .env/
# - A clone of qemu-tintin-images in ~/projects/qemu-tintin-images
# - Access to the cloudpebble heroku app

from fabric.api import *
from fabric.tasks import execute

env.roledefs = {
    'qemu': ['ec2-user@qemu-us1.cloudpebble.net', 'ec2-user@qemu-us2.cloudpebble.net'],
    'ycmd': ['root@ycm3.cloudpebble.net', 'root@ycm4.cloudpebble.net'],
}
env.key_filename = ['~/.ssh/id_rsa', '~/Downloads/katharine-keypair.pem']

@task
@roles('qemu')
def update_qemu_service():
    with cd("cloudpebble-qemu-controller"):
        run("git pull")
        run("git submodule update --init --recursive")
        with prefix(". .env/bin/activate"):
            run("pip install -r requirements.txt")
    sudo("restart cloudpebble-qemu")


@task
@roles('qemu')
def update_qemu_sdk():
    with cd('qemu'):
        run("git pull")
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
def restart_qemu_service():
    sudo("restart cloudpebble-qemu")


@task
@roles('ycmd')
def update_ycmd_sdk(sdk_version):
    with cd("/home/ycm"), settings(sudo_user="ycm", shell="/bin/bash -c"):
        sudo("wget -nv -O sdk.tar.gz https://sdk.getpebble.com/download/%s?source=cloudpebble" % sdk_version)
        sudo("tar -xf sdk.tar.gz")
        sudo("rm -rf sdk3")
        sudo("mv PebbleSDK-%s sdk3" % sdk_version)


@task
@roles('ycmd')
def update_ycmd_service():
    with cd("/home/ycm/proxy"), settings(sudo_user="ycm", shell="/bin/bash -c"):
        sudo("git pull")
        run("restart ycmd-proxy")

@task
@roles('ycmd')
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


@task
@runs_once
def update_qemu_images(sdk_version):
    # Merge conflicts are no fun.
    with lcd("~/projects/qemu-tintin-images"):
        local("git pull")

    with lcd("~/projects/tintin"):
        local("git checkout v%s" % sdk_version)
        with prefix(". .env/bin/activate"):
            local("pypy ./waf configure --board=snowy_bb --qemu --release --sdkshell build qemu_image_spi qemu_image_micro")
        local("cp build/qemu_* ~/projects/qemu-tintin-images/basalt/3.0/")

    with lcd("~/projects/qemu-tintin-images"):
        local("git commit -a -m 'Update to v%s'" % sdk_version)
        local("git push")


@task
@runs_once
def update_cloudpebble_sdk(sdk_version):
    local("sed -i.bak 's/download\/3.[a-z0-9-]*/download\/%s/' bin/post_compile bootstrap.sh" % sdk_version)
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
