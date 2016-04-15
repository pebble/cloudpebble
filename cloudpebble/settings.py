# encoding: utf-8
# Django settings for cloudpebble project.

import os
import socket
import dj_database_url
import sys
_environ = os.environ

DEBUG = _environ.get('DEBUG', '') != ''

TESTING = 'test' in sys.argv
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

ADMINS = (
    ('Administrator', 'example@example.com'),
)
MANAGERS = ADMINS

DEFAULT_FROM_EMAIL = _environ.get('FROM_EMAIL', 'CloudPebble <cloudpebble@example.com>')

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

MANAGERS = ADMINS

if 'TRAVIS' in _environ:
    DATABASES = {
        'default': {
            'ENGINE':   'django.db.backends.postgresql_psycopg2',
            'NAME':     'travisci',
            'USER':     'postgres',
            'PASSWORD': '',
            'HOST':     'localhost',
            'PORT':     '',
        }
    }
elif 'DATABASE_URL' not in _environ:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': 'postgres',
            'USER': 'postgres',
            'HOST': 'postgres',
            'PORT': 5432,
        }
    }
else:
    DATABASES = {
        'default': dj_database_url.config()
    }

PROJECT_PATH = os.path.dirname(os.path.abspath(__file__)) + '/../'

LANGUAGE_COOKIE_NAME = 'cloudpebble_language'

# Hosts/domain names that are valid for this site; required if DEBUG is False
# See https://docs.djangoproject.com/en/1.5/ref/settings/#allowed-hosts
ALLOWED_HOSTS = ['*']

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# In a Windows environment this must be set to your system time zone.
TIME_ZONE = 'America/New_York'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-gb'

LANGUAGES = (
    ('en', 'English'),
    ('es', 'Spanish'),
    ('fr', 'French'),
    ('de', 'German'),
    ('zh-cn', 'Chinese (simplified'),
    ('zh-tw', 'Chinese (traditional)'),
)

LOCALE_PATHS = (os.getcwd() + "/locale",)

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale.
USE_L10N = True

# If you set this to False, Django will not use timezone-aware datetimes.
USE_TZ = True

# Absolute filesystem path to the directory that will hold user-uploaded files.
# Example: "/var/www/example.com/media/"
MEDIA_ROOT = os.getcwd() + '/user_data/build_results/'

SIMPLYJS_ROOT = os.getcwd() + '/ext/simplyjs/'
PEBBLEJS_ROOT = os.getcwd() + '/ext/pebblejs/'

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash.
# Examples: "http://example.com/media/", "http://media.example.com/"
MEDIA_URL = _environ.get('MEDIA_URL', 'http://localhost:8001/builds/')

# Absolute path to the directory static files should be collected to.
# Don't put anything in this directory yourself; store your static files
# in apps' "static/" subdirectories and in STATICFILES_DIRS.
# Example: "/var/www/example.com/static/"
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# URL prefix for static files.
# Example: "http://example.com/static/", "http://static.example.com/"
STATIC_URL = '/static/'

PUBLIC_URL = _environ.get('PUBLIC_URL', 'http://localhost:8000/') # This default is completely useless.


if DEBUG or TESTING:
    # Additional locations of static files
    STATICFILES_DIRS = (
        # This is used instead of django-bower's finder, because django-pipeline
        # is actually better than django-bower at filtering out unneeded static
        # files.
        os.path.join(os.path.dirname(__file__), '..', 'bower_components'),
    )
    STATICFILES_FINDERS = (
        'pipeline.finders.FileSystemFinder',
        'pipeline.finders.AppDirectoriesFinder',
        'pipeline.finders.PipelineFinder',
    )
    STATICFILES_STORAGE = 'pipeline.storage.PipelineStorage'

else:
    STATICFILES_FINDERS = (
        'django.contrib.staticfiles.finders.FileSystemFinder',
        'django.contrib.staticfiles.finders.AppDirectoriesFinder',
        'djangobower.finders.BowerFinder',
        'pipeline.finders.PipelineFinder',
    )
    STATICFILES_STORAGE = 'cloudpebble.storages.CompressedManifestPipelineStorage'


BOWER_INSTALLED_APPS = (
    'https://github.com/krisk/Fuse.git#2c1560d763',
    'jquery#~2.1.3',
    'underscore',
    'backbone',
    'text-encoding',
    'jshint/jshint',
    'html.sortable#~0.3.1',
    'alexgorbatchev/jquery-textext',
    'codemirror#4.2.0',
    'bluebird#3.3.4',
    'kanaka/noVNC',
    'react#15.0.1',
    'classnames'
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = _environ.get('SECRET_KEY', 'y_!-!-i!_txo$v5j(@c7m4uk^jyg)l4bf*0yqrztmax)l2027j')

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.contrib.auth.context_processors.auth',
                'django.template.context_processors.debug',
                'django.template.context_processors.i18n',
                'django.template.context_processors.media',
                'django.template.context_processors.static',
                'django.template.context_processors.tz',
                'django.template.context_processors.request',
                'django.contrib.messages.context_processors.messages',
                "social.apps.django_app.context_processors.backends",
                "social.apps.django_app.context_processors.login_redirect",
            ]
        }
    }
]

MIDDLEWARE_CLASSES = (
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    # Uncomment the next line for simple clickjacking protection:
    # 'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

AUTHENTICATION_BACKENDS = (
    'site_auth.pebble.PebbleOAuth2',
    'django.contrib.auth.backends.ModelBackend',
)

SOCIAL_AUTH_PIPELINE = (
    'social.pipeline.social_auth.social_details',
    'social.pipeline.social_auth.social_uid',
    'social.pipeline.social_auth.auth_allowed',
    'site_auth.pebble.merge_user',  # formerly social.pipeline.social_auth.social_user
    'social.pipeline.user.get_username',
    'social.pipeline.user.create_user',
    'social.pipeline.social_auth.associate_user',
    'site_auth.pebble.clear_old_login',
    'social.pipeline.social_auth.load_extra_data',
    'social.pipeline.user.user_details'
)

SOCIAL_AUTH_PEBBLE_KEY = _environ.get('PEBBLE_AUTH_KEY', 'bab3e760ede6e592517682837a054beff83c8a80725d8e13fa122e8e87e99c20')
SOCIAL_AUTH_PEBBLE_SECRET = _environ.get('PEBBLE_AUTH_SECRET', '7bf8b96fd736f3a2ac12d472b0703d44503441913626deed86180c0f47dcbb08')

SOCIAL_AUTH_PEBBLE_ROOT_URL = _environ.get('PEBBLE_AUTH_URL', None)
PEBBLE_AUTH_ADMIN_TOKEN = _environ.get('PEBBLE_AUTH_ADMIN_TOKEN', None)

SHOULD_BE_SECURE = _environ.get('EXPECT_SSL', '') != ''

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = SHOULD_BE_SECURE
CSRF_COOKIE_SECURE = SHOULD_BE_SECURE

SOCIAL_AUTH_PEBBLE_REQUIRED = 'PEBBLE_AUTH_REQUIRED' in _environ

ROOT_URLCONF = 'cloudpebble.urls'

# Python dotted path to the WSGI application used by Django's runserver.
WSGI_APPLICATION = 'cloudpebble.wsgi.application'

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Uncomment the next line to enable the admin:
    # 'django.contrib.admin',
    # Uncomment the next line to enable admin documentation:
    # 'django.contrib.admindocs',
    'social.apps.django_app.default',
    'ide',
    'site_auth',
    'pipeline',
    'root',
    'qr',
    'orchestrator_proxy',
    'registration',
    'djangobower',
)

NODE_MODULES_PATH = _environ.get('NODE_MODULES_PATH')
BABEL_PATH = _environ.get('BABEL_PATH', os.path.join(NODE_MODULES_PATH, 'babel-cli/bin/babel.js'))
BABEL_PRESETS = [
    'babel-preset-stage-2',
    'babel-preset-react',
    'babel-preset-es2015'
]


# Configuration for django-pipeline, used to concatenate and compress JS and CSS sources and
# output source-maps.
PIPELINE = {
    'COMPILERS': ('pipeline.compilers.es6.ES6Compiler', ),
    'BABEL_BINARY': BABEL_PATH,
    'BABEL_ARGUMENTS': '--presets {}'.format(",".join(os.path.join(NODE_MODULES_PATH, p) for p in BABEL_PRESETS)),
    'OUTPUT_SOURCEMAPS': True,
    'JS_COMPRESSOR': 'pipeline.compressors.uglifyjs.UglifyJSCompressor',
    'CSS_COMPRESSOR': 'pipeline.compressors.cleancss.CleanCSSCompressor',
    'CLEANCSS_BINARY': 'cleancss',
    'UGLIFYJS_BINARY': 'uglifyjs',
    'VERBOSE': True,
    'STYLESHEETS': {
        'codemirror': {
            'source_filenames': (
                'CodeMirror/addon/hint/show-hint.css',
                'CodeMirror/addon/dialog/dialog.css',
                'CodeMirror/lib/codemirror.css',
                'CodeMirror/theme/monokai.css',
                'CodeMirror/theme/eclipse.css',
                'CodeMirror/theme/blackboard.css',
                'CodeMirror/theme/solarized.css',
                'CodeMirror/addon/fold/foldgutter.css',
            ),
            'output_filename': 'build/codemirror.css'
        },
        'textext': {
            'source_filenames': (
                'jquery-textext/src/css/textext.core.css',
                'jquery-textext/src/css/textext.plugin.tags.css',
                'jquery-textext/src/css/textext.plugin.autocomplete.css',
                'jquery-textext/src/css/textext.plugin.focus.css',
                'jquery-textext/src/css/textext.plugin.prompt.css',
                'jquery-textext/src/css/textext.plugin.arrow.css',
            ),
            'output_filename': 'build/textext.css'
        },
        'ide': {
            'source_filenames': (
                'ide/css/ide.css',
                'ide/css/ib.css',
                'ide/css/codemirror-default.css',
            ),
            'output_filename': 'build/ide.css'
        },
        'base': {
            'source_filenames': (
                'common/fonts/fonts.css',
                'common/css/progress.css',
                'common/css/common.css',
                'ide/css/base.css',
            ),
            'output_filename': 'build/base.css'
        }
    },
    'JAVASCRIPT': {
        'ide': {
            'source_filenames': (
                'ide/js/cloudpebble.js',
                'ide/js/editor.js',
                'ide/js/ib/ib.js',
                'ide/js/ib/registry.js',
                'ide/js/*.js',
                'ide/js/*/*.js',
                'ide/js/*/*.es6',
            ),
            'output_filename': 'build/ide.js',
        },
        'lib': {
            'source_filenames': (
                'react/react.js',
                'react/react-dom.js',
                'classnames/index.js',
                'CodeMirror/lib/codemirror.js',
                'CodeMirror/addon/dialog/dialog.js',
                'CodeMirror/addon/search/searchcursor.js',
                'CodeMirror/addon/search/search.js',
                'CodeMirror/addon/edit/matchbrackets.js',
                'CodeMirror/addon/edit/closebrackets.js',
                'CodeMirror/addon/comment/comment.js',
                'CodeMirror/addon/fold/foldgutter.js',
                'CodeMirror/addon/fold/foldcode.js',
                'CodeMirror/addon/fold/brace-fold.js',
                'CodeMirror/addon/fold/comment-fold.js',
                'CodeMirror/addon/runmode/runmode.js',
                'ide/external/codemirror.hint.js',
                'fuse.js/src/fuse.js',
                'CodeMirror/mode/clike/clike.js',
                'CodeMirror/mode/javascript/javascript.js',
                'CodeMirror/keymap/emacs.js',
                'CodeMirror/keymap/vim.js',
                'ide/external/uuid.js',
                'jshint/dist/jshint.js',
                'html.sortable/dist/html.sortable.min.js',
                'text-encoding/lib/encoding.js',
                'noVNC/include/util.js',
                'jquery-textext/src/js/*.js',
            ),
            'output_filename': 'build/textext.js',
        },
        'base': {
            'source_filenames': (
                'jquery/dist/jquery.min.js',
                'common/js/modal.js',
                'bluebird/js/browser/bluebird.js',
                'underscore/underscore-min.js',
                'backbone/backbone-min.js',
                'common/js/whats_new.js',
                'common/js/ajax.js'
            ),
            'output_filename': 'build/base.js',
        }
    }
}

# This logging configuring ensures that debug messages are logged even when DEBUG=False
# It replaces the previous and non-functional configuration which attempted to send
# mail to administrators.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse'
        }
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler'
        }
    },
    'loggers': {
        '*': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False
        }
    }
}

REDIS_URL = _environ.get('REDIS_URL', None) or _environ.get('REDISCLOUD_URL', 'redis://redis:6379')

BROKER_URL = REDIS_URL + '/1'
CELERY_RESULT_BACKEND = BROKER_URL
CELERY_ACCEPT_CONTENT = ['pickle']
CELERY_TASK_SERIALIZER = 'pickle'

CELERYD_TASK_TIME_LIMIT = int(_environ.get('CELERYD_TASK_TIME_LIMIT', 620))
CELERYD_TASK_SOFT_TIME_LIMIT = int(_environ.get('CELERYD_TASK_SOFT_TIME_LIMIT', 600))

BROKER_POOL_LIMIT = int(_environ.get('BROKER_POOL_LIMIT', 10))

LOGIN_REDIRECT_URL = '/ide/'

LOGIN_URL = '/#login'

FILE_STORAGE = os.getcwd() + '/user_data/'

CHROOT_ROOT = None

DEFAULT_TEMPLATE = None

EXPORT_DIRECTORY = os.getcwd() + '/user_data/export/'

EXPORT_ROOT = _environ.get('EXPORT_ROOT', 'http://localhost:8001/export/')

GITHUB_CLIENT_ID = _environ.get('GITHUB_ID', '15c3418f8f5c0f956ed8')
GITHUB_CLIENT_SECRET = _environ.get('GITHUB_SECRET', '06e9f765f00016a79a38599fbd858990b23b8afe')

GITHUB_HOOK_TEMPLATE = _environ.get('GITHUB_HOOK', 'http://example.com/ide/project/%(project)d/github/push_hook?key=%(key)s')

SDK2_PEBBLE_WAF = _environ.get('SDK2_PEBBLE_WAF', '/sdk2/pebble/waf')
SDK3_PEBBLE_WAF = _environ.get('SDK3_PEBBLE_WAF', '/sdk3/pebble/waf')

ARM_CS_TOOLS = _environ.get('ARM_CS_TOOLS', '/arm-cs-tools/bin/')

TD_URL = _environ.get('TD_URL', None)
TD_ENABLED = _environ.get('TD_ENABLED', False)

MAILCHIMP_API_KEY = _environ.get('MAILCHIMP_API_KEY', None)
MAILCHIMP_LIST_ID = _environ.get('MAILCHIMP_LIST_ID', None)

AWS_ENABLED = 'AWS_ENABLED' in _environ
AWS_ACCESS_KEY_ID = _environ.get('AWS_ACCESS_KEY_ID', None)
AWS_SECRET_ACCESS_KEY = _environ.get('AWS_SECRET_ACCESS_KEY', None)

AWS_S3_SOURCE_BUCKET = _environ.get('AWS_S3_SOURCE_BUCKET', 'source.cloudpebble.net')
AWS_S3_BUILDS_BUCKET = _environ.get('AWS_S3_BUILDS_BUCKET', 'builds.cloudpebble.net')
AWS_S3_EXPORT_BUCKET = _environ.get('AWS_S3_EXPORT_BUCKET', 'export.cloudpebble.net')
AWS_S3_HOST = _environ.get('AWS_S3_HOST', None)
AWS_S3_FAKE_S3 = _environ.get('AWS_S3_FAKE_S3', None)

TYPOGRAPHY_CSS = _environ.get('TYPOGRAPHY_CSS', None)

LIBPEBBLE_PROXY = _environ.get('LIBPEBBLE_PROXY', None)

YCM_URLS = _environ.get('YCM_URLS', 'http://localhost:8002/').split(',')
COMPLETION_CERTS = _environ.get('COMPLETION_CERTS', os.getcwd() + '/completion-certs.crt')

QEMU_URLS = _environ.get('QEMU_URLS', 'http://qemu/').split(',')
QEMU_LAUNCH_AUTH_HEADER = _environ.get('QEMU_LAUNCH_AUTH_HEADER', 'secret')
QEMU_LAUNCH_TIMEOUT = int(_environ.get('QEMU_LAUNCH_TIMEOUT', 20))

PHONE_SHORTURL = _environ.get('PHONE_SHORTURL', 'cpbl.io')

ORCHESTRATOR_URL = _environ.get('ORCHESTRATOR_URL', 'http://orchestrator.hq.getpebble.com')

# Tests can set this setting to false to override the server-side check for existing builds
# when running monkeyscript tests
STRICT_TEST_BUNDLES = True

# import local settings
try:
    from settings_local import *
except ImportError:
    print "No local settings overrides."
    pass

socket.setdefaulttimeout(int(_environ.get("DEFAULT_SOCKET_TIMEOUT", 10)))

# Don't keep these hanging around in the environment.
if not DEBUG:
    for key in _environ.keys():
        # We need these ones to run.
        if key in {'PATH', 'TZ', 'RUN_MAIN', 'CELERY_LOADER', 'DJANGO_SETTINGS_MODULE', 'DEBUG', 'C_FORCE_ROOT'}:
            continue
        del _environ[key]
