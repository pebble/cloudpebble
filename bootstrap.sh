#!/usr/bin/env bash

echo "Replacing ubuntu mirrors with ones that suck less."
sudo sed -i -e 's#us.archive.ubuntu.com#mirrors.mit.edu#g' /etc/apt/sources.list


# Install a bunch of things we want
apt-get update
apt-get install -y aptitude
aptitude install -y python-pip mercurial git python-dev python-psycopg2 rabbitmq-server libmpc libevent-dev lighttpd \
                        python-software-properties cmake build-essential

# We need a more recent redis than Ubuntu provides.
add-apt-repository -y ppa:chris-lea/redis-server

# Install node for jshint
aptitude install -y g++ make
add-apt-repository -y ppa:chris-lea/node.js
apt-get update
aptitude install -y nodejs
npm install -g jshint

# Install redis
aptitude install -y redis-server

# Make our static server useful.
ln -s /vagrant/user_data/build_results /var/www/builds 
ln -s /vagrant/user_data/export /var/www/export

# CloudPebble python requirements.
pip install -r /vagrant/requirements.txt

# Make sure we have a useful database
pushd /vagrant
    sudo -u vagrant python manage.py syncdb --noinput
    sudo -u vagrant python manage.py migrate
popd

# We'll need this later
wget --progress=bar:force -O arm-cs-tools.tar.bz2 http://assets.getpebble.com.s3-website-us-east-1.amazonaws.com/sdk/arm-cs-tools-ubuntu-12.04-2012-12-22.tar.bz2
sudo -u vagrant tar -xjf arm-cs-tools.tar.bz2
rm arm-cs-tools.tar.bz2

# Obtain the SDK.
sudo -u vagrant mkdir sdk2
pushd sdk2
    wget --progress=bar:force -O sdk.tar.gz https://s3.amazonaws.com/assets.getpebble.com/sdk2/PebbleSDK-2.6.1.tar.gz
    sudo -u vagrant tar --strip 1 -xzf sdk.tar.gz
    rm sdk.tar.gz
    sudo -u vagrant ln -s ~/arm-cs-tools arm-cs-tools
    pip install -r requirements.txt
popd

# Fetch autocompletion tools.
mkdir /ycmd
pushd /ycmd
    git clone https://github.com/Valloric/ycmd.git .
    git reset --hard c5ae6c2915e9fb9f7c18b5ec9bf8627d7d5456fd
    git submodule update --init --recursive
    ./build.sh --clang-completer
popd

sudo -u vagrant mkdir ycmd-proxy
pushd ycmd-proxy
    git clone https://github.com/pebble/cloudpebble-ycmd-proxy.git .
    pip install -r requirements.txt
popd

# Set up CORS on the lighttpd server.
cat << 'EOF' > /etc/lighttpd/conf-available/20-cors.conf
server.modules += ("mod_setenv")
setenv.add-response-header = ("Access-Control-Allow-Origin" => "*")
setenv.add-response-header += ("Access-Control-Allow-Headers" => "x-requested-with")

EOF
lighttpd-enable-mod cors
/etc/init.d/lighttpd restart

# Set up some upstart stuff.
cat << 'EOF' > /etc/init/cloudpebble.conf
description "cloudpebble server"
author "Katharine Berry"

start on vagrant-mounted
stop on shutdown

setuid vagrant
setgid vagrant
chdir /vagrant

console log

script
    export PATH="$PATH:/home/vagrant/arm-cs-tools/bin:/home/vagrant/sdk2/bin"
    export DEBUG=yes
    exec /usr/bin/python manage.py runserver 0.0.0.0:8000
end script

EOF

cat << 'EOF' > /etc/init/cloudpebble-celery.conf
description "cloudpebble celery"
author "Katharine Berry"

start on vagrant-mounted
# Because if we don't stop before rabbitmq we hang.
stop on runlevel [!2345]

setuid vagrant
setgid vagrant
chdir /vagrant

console log

script
    export PATH="$PATH:/home/vagrant/arm-cs-tools/bin:/home/vagrant/sdk2/bin"
    export DEBUG=yes
    exec /usr/bin/python manage.py celery worker --autoreload --loglevel=info --no-color
end script

EOF

cat << 'EOF' > /etc/init/cloudpebble-ycmd.conf
description "cloudpebble ycmd proxy"
author "Katharine Berry"

start on vagrant-mounted
stop on shutdown

setuid vagrant
setgid vagrant
chdir /home/vagrant/ycmd-proxy

console log

script
    export PATH="$PATH:/home/vagrant/arm-cs-tools/bin:/home/vagrant/sdk2/bin"
    export DEBUG=yes
    export YCMD_BINARY="/ycmd/ycmd/__main__.py"
    export YCMD_DEFAULT_SETTINGS="/ycmd/ycmd/default_settings.json"
    export YCMD_PEBBLE_SDK="/home/vagrant/sdk2/"
    export YCMD_STDLIB="/home/vagrant/arm-cs-tools/arm-eabi-none/include/"
    export YCMD_PORT=8002
    exec /usr/bin/python proxy.py
end script

EOF

# Go!
start cloudpebble
start cloudpebble-celery
start cloudpebble-ycmd
