FROM python:2.7.11
MAINTAINER Katharine Berry <katharine@pebble.com>

ENV NPM_CONFIG_LOGLEVEL=info NODE_VERSION=4.2.3 DJANGO_VERSION=1.6

# Node stuff.

# gpg keys listed at https://github.com/nodejs/node
RUN set -ex \
  && for key in \
    9554F04D7259F04124DE6B476D5A82AC7E37093B \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    0034A06D9D9B0064CE8ADF6BF1747F4AD2306D93 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
  ; do \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key"; \
  done

RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
  && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --verify SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
  && tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc

RUN npm install -g npm jshint

# Django stuff

RUN apt-get update && apt-get install -y \
    gettext \
    postgresql-client libpq-dev \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

RUN pip install psycopg2 django=="$DJANGO_VERSION"

EXPOSE 8000

# CloudPebble stuff
RUN npm install -g bower && echo '{"allow_root": true}' > ~/.bowerrc

# Grab the toolchain
RUN curl -o /tmp/arm-cs-tools.tar https://cloudpebble-vagrant.s3.amazonaws.com/arm-cs-tools-stripped.tar && \
  tar -xf /tmp/arm-cs-tools.tar -C / && rm /tmp/arm-cs-tools.tar

ADD requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

ENV SDK_TWO_VERSION=2.9

# Install SDK 2
RUN mkdir /sdk2 && \
  curl -L "https://s3.amazonaws.com/assets.getpebble.com/sdk3/sdk-core/sdk-core-${SDK_TWO_VERSION}.tar.bz2" | \
  tar --strip-components=1 -xj -C /sdk2

ENV SDK_THREE_CHANNEL=beta
ENV SDK_THREE_VERSION=4.0-beta16

# Install SDK 3
RUN mkdir /sdk3 && \
  curl -L "https://s3.amazonaws.com/assets.getpebble.com/sdk3/${SDK_THREE_CHANNEL}/sdk-core-${SDK_THREE_VERSION}.tar.bz2" | \
  tar --strip-components=1 -xj -C /sdk3

COPY . /code
WORKDIR /code

# Bower is awful.
RUN rm -rf bower_components && cd /tmp && python /code/manage.py bower install && mv bower_components /code/

RUN python manage.py compilemessages

RUN make -C /code/c-preload

CMD ["sh", "docker_start.sh"]
