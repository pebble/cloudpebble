from uuid import uuid4
from utils.redis_helper import redis_client


def make_uuid(job_id, kind='job'):
    """ Generate a UUID for an Orchestrator job or log ID (or find one which already exists), and store it in redis.
    :param job_id: Orchestrator job ID
    :param kind: The kind of ID being stored
    :return: A temporary UUID to look up the job ID
    :type job_id: str
    :type job_id: str
    :rtype: str
    """

    uuid = redis_client.get('orchestrator-reverse-{}-{}'.format(kind, job_id))
    if uuid is None:
        uuid = str(uuid4())
        one_hour = 3600
        redis_client.set('orchestrator-{}-{}'.format(kind, uuid), job_id, ex=one_hour)
        redis_client.set('orchestrator-reverse-{}-{}'.format(kind, job_id), uuid, ex=one_hour)

    return uuid


def lookup_uuid(uuid, kind='job'):
    """ Fetch an Orchestrator job ID given a generated UUID
    :param uuid: A UUID generated from make_uuid
    :param kind: The kind of ID being stored
    :type uuid: str
    :return: The corresponding Orchestrator job ID
    :type uuid: str
    :rtype: str
    """
    job_id = redis_client.get('orchestrator-{}-{}'.format(kind, uuid))
    if job_id is None:
        raise KeyError('Invalid job ID')
    return job_id
