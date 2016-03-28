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
from django.core.exceptions import PermissionDenied

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


def _make_error(message):
    return {
        'success': False,
        'error': message
    }


def json_view(f):
    @wraps(f)
    def _wrapped(request, *args, **kwargs):
        try:
            ret = f(request, *args, **kwargs)

            # Some errors are not exceptions
            if isinstance(ret, http.HttpResponseNotAllowed):
                return http.HttpResponse(json.dumps(_make_error(_('HTTP method not allowed.'))), status=405, content_type=JSON)

            if isinstance(ret, http.HttpResponseBadRequest):
                return http.HttpResponse(json.dumps(_make_error(_('Bad Request'))), status=400, content_type=JSON)

            # Allow other HttpResponses through
            if isinstance(ret, http.HttpResponse):
                return ret

            # Functions without return values default to a dict which just contains {success: true}
            if ret is None:
                ret = {}
            if 'success' not in ret:
                ret['success'] = True

            content = json.dumps(ret)
            return http.HttpResponse(content, status=200, content_type=JSON)

        except http.Http404 as e:
            logger.warning('Not found: %s', request.path,
                           extra={
                               'status_code': 404,
                               'request': request,
                           })
            return http.HttpResponseNotFound(json.dumps(_make_error(str(e))), content_type=JSON)

        except PermissionDenied as e:
            logger.warning(
                'Forbidden (Permission denied): %s', request.path,
                extra={
                    'status_code': 403,
                    'request': request,
                })
            return http.HttpResponseForbidden(json.dumps(_make_error(str(e))), content_type=JSON)
        except BadRequest as e:
            return http.HttpResponseBadRequest(json.dumps(_make_error(str(e))), content_type=JSON)
        except Exception as e:
            data = _make_error(_('An error has occurred'))
            if settings.DEBUG or isinstance(e, InternalServerError):
                data['error'] = str(e)
            if settings.DEBUG:
                data['traceback'] = traceback.format_exc()
            content = json.dumps(data)

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
