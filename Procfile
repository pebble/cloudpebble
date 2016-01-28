web: newrelic-admin run-program gunicorn -c gunicorn.py cloudpebble.wsgi
celery: newrelic-admin run-program celery worker -A cloudpebble -E -l info
