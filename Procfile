web: newrelic-admin run-program gunicorn -c gunicorn.py cloudpebble.wsgi
celery: python manage.py celery worker -P gevent -E -l info
