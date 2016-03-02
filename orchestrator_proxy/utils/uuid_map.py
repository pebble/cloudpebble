""" create and look up temporary mappings from Orchestrator object IDs to CloudPebble UUIDs.

An orchestrator job is assigned two UUIDs. One which is sent to the third party developer, and another which
is given to orchestrator.

- The developer can use their UUID to poll cloudpebble for the test result. If the job is marked as completed,
  the request is passed on to Orchestrator to get the test result info, otherwise a simple "in progress" message
  is returned.
- Orchestrator uses its UUID in the notification callback to alert CloudPebble that the job is complete.

Two UUIDs are used in order to prevent a developer from sending their own notification callback (which would then
allow them to poll Orchestrator themselves).

The UUID mappings and test completion state are all stored in redis, with expiry times of one hour.
"""

from uuid import uuid4
from utils.redis_helper import redis_client

_one_hour = 3600


def make_uuid(orch_id, kind='public', uuid=None, unique=False):
    """ Map an orchestrator ID to a UUID
    :param orch_id: An ID from orchestrator
    :param kind: UUID namespace
    :param uuid: Optional, a pre-determined UUID. Generates a new one if not given.
    :param unique: If True, adds a reverse mapping from the job ID to the UUID.
    :return: The new or existing UUID
    """
    if unique:
        uuid = redis_client.get('orchestrator-reverse-{}-{}'.format(kind, orch_id))
    if uuid is None:
        uuid = str(uuid4())
    redis_client.set('orchestrator-{}-{}'.format(kind, uuid), orch_id, ex=_one_hour)
    if unique:
        redis_client.set('orchestrator-reverse-{}-{}'.format(kind, orch_id), uuid, ex=_one_hour)
    return uuid


def lookup_uuid(uuid, kind='public'):
    """ Fetch an Orchestrator job ID given a generated UUID
    :param uuid: A UUID generated from make_uuid
    :param kind: UUID namespace
    :return: The corresponding Orchestrator job ID
    """
    orch_id = redis_client.get('orchestrator-{}-{}'.format(kind, uuid))
    if orch_id is None:
        raise KeyError('Invalid orchestrator UUID')
    return orch_id


def set_notified(orch_id, is_notified):
    """ Set or the value of the 'test completed' flag for a job
    :param orch_id: The ID of an test job from Ochestrator
    :param is_notified: Whether or not the job is complete
    """
    redis_client.set('orchestrator-notified-{}'.format(orch_id), is_notified, ex=_one_hour)


def is_notified(orch_id):
    """ Check if a job is complete
    :param orch_id:
    :return: True if the job has been flagged as completed.
    """
    notified = redis_client.get('orchestrator-notified-{}'.format(orch_id))
    if notified not in ('True', 'False'):
        raise KeyError('Invalid orchestrator ID')
    return True if notified == 'True' else False
