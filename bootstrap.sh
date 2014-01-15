#!/usr/bin/env bash

apt-get update
# Install a bunch of things we want
apt-get install -y aptitude
aptitude install -y python-pip mercurial git python-dev python-psycopg2 rabbitmq-server libmpc libevent-dev lighttpd

# Install node for jshint
aptitude install -y g++ make python-software-properties
add-apt-repository -y ppa:chris-lea/node.js
apt-get update
aptitude install -y nodejs
npm install -g jshint

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
sudo -u vagrant mkdir sdk1
pushd sdk1
    sudo -u vagrant git clone https://github.com/pebble/pebblekit.git .
    # Make sure we actually have an SDK1 revision
    sudo -u vagrant git reset --hard 19f6810bad92b669830d2a274dba13c72c58c5d3
    pip install -r Pebble/sdk/requirements.txt
popd

sudo -u vagrant mkdir sdk2
pushd sdk2
    # Host this ourselves until Pebble stops being silly.
    wget --progress=bar:force -O sdk.tar.gz http://cloudpebble-vagrant.s3.amazonaws.com/PebbleSDK-2.0-BETA4.tar.gz
    sudo -u vagrant tar --strip 1 -xzf sdk.tar.gz
    rm sdk.tar.gz
    sudo -u vagrant ln -s ~/arm-cs-tools arm-cs-tools
    pip install -r requirements.txt
popd

# Set up CORS on the lighttpd server.
cat << 'EOF' > /etc/lighttpd/conf-available/20-cors.conf
server.modules += ("mod_setenv")
setenv.add-response-header = ("Access-Control-Allow-Origin" => "*")

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
    exec /usr/bin/python manage.py celery worker --autoreload --loglevel=info --no-color
end script

EOF

# Go!
start cloudpebble
start cloudpebble-celery
