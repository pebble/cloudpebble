"""
Based on https://github.com/jsocol/django-jsonview
"""

import json
import logging
import traceback
from functools import wraps
from django import http
from django.core.handlers.base import BaseHandler
from django.conf import settings
from django.core.signals import got_request_exception
from django.utils.translation import ugettext as _
from django.core.exceptions import PermissionDenied, ValidationError

JSON = 'application/json'
logger = logging.getLogger('django.request')


class BadRequest(Exception):
    """ Raises a HTTP 400 exception with a message sent to the client """
    pass


class InternalServerError(Exception):
    """ Raises a HTTP 500 exception with a message sent to the client.

    The default Exception also produces a HTTP 500 but does not send a message
    to the client """
    pass


def json_dumps(obj):
    """ Pretty print API output in debug mode to make debugging nicer. """
    if not settings.DEBUG:
        return json.dumps(obj)
    else:
        return json.dumps(obj, indent=2, separators=(',', ': '), sort_keys=True)


def json_view(*args, **kwargs):
    include_success = kwargs.get('include_success', True)

    def _make_error(message):
        err = {'error': message}
        if include_success:
            err['success'] = False
        return err

    def decorator(f):
        @wraps(f)
        def _wrapped(request, *args, **kwargs):
            try:
                ret = f(request, *args, **kwargs)

                # Some errors are not exceptions
                if isinstance(ret, http.HttpResponseNotAllowed):
                    return http.HttpResponse(json_dumps(_make_error(_('HTTP method not allowed.'))), status=405, content_type=JSON)

                if isinstance(ret, http.HttpResponseBadRequest):
                    return http.HttpResponse(json_dumps(_make_error(_('Bad Request'))), status=400, content_type=JSON)

                # Allow other HttpResponses through
                if isinstance(ret, http.HttpResponse):
                    return ret

                # Functions without return values default to a dict which just contains {success: true}
                if ret is None:
                    ret = {}
                if include_success and 'success' not in ret:
                    ret['success'] = True

                content = json_dumps(ret)
                return http.HttpResponse(content, status=200, content_type=JSON)

            except http.Http404 as e:
                logger.warning('Not found: %s', request.path,
                               extra={
                                   'status_code': 404,
                                   'request': request,
                               })
                return http.HttpResponseNotFound(json_dumps(_make_error(str(e))), content_type=JSON)

            except PermissionDenied as e:
                logger.warning(
                    'Forbidden (Permission denied): %s', request.path,
                    extra={
                        'status_code': 403,
                        'request': request,
                    })
                return http.HttpResponseForbidden(json_dumps(_make_error(str(e))), content_type=JSON)
            except BadRequest as e:
                return http.HttpResponseBadRequest(json_dumps(_make_error(str(e))), content_type=JSON)
            except ValidationError as e:
                # Validation errors are raised for errors such as invalid file names.
                # We return HTTP 400s in these cases, and send back a comma separated string of errors.
                # (although generally there will only be one error)
                return http.HttpResponseBadRequest(json_dumps(_make_error(", ".join(e.messages))), content_type=JSON)
            except Exception as e:
                data = _make_error(_('An error has occurred'))
                if settings.DEBUG or isinstance(e, InternalServerError):
                    data['error'] = str(e)
                if settings.DEBUG:
                    data['traceback'] = traceback.format_exc()
                content = json_dumps(data)

                # Generate the usual 500 error email with stack trace and full
                # debugging information
                logger.error(
                    'Internal Server Error: %s', request.path,
                    exc_info=True,
                    extra={
                        'status_code': 500,
                        'request': request
                    }
                )

                # Here we lie a little bit. Because we swallow the exception,
                # the BaseHandler doesn't get to send this signal. It sets the
                # sender argument to self.__class__, in case the BaseHandler
                # is subclassed.
                got_request_exception.send(sender=BaseHandler, request=request)
                return http.HttpResponseServerError(content, content_type=JSON)

        return _wrapped

    if len(args) == 1 and callable(args[0]):
        return decorator(args[0])
    else:
        return decorator
