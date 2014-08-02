worker_class = 'gevent'
workers = 3


def post_fork(server, worker):
    from psycogreen.gevent import patch_psycopg
    patch_psycopg()
