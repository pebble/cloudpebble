web: newrelic-admin run-program gunicorn -w $WEB_CONCURRENCY cloudpebble.wsgi
celery: newrelic-admin run-program python manage.py celeryd -E -l info
