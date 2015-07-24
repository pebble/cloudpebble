import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST, require_safe
from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.files import ResourceFile, ResourceIdentifier, ResourceVariant
from utils.keen_helper import send_keen_event
import utils.s3 as s3

__author__ = 'katharine'


@require_POST
@login_required
def create_resource(request, project_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    kind = request.POST['kind']
    resource_ids = json.loads(request.POST['resource_ids'])
    default_file = request.FILES.get('file', None)
    colour_file = request.FILES.get('file_colour', None)
    file_name = request.POST['file_name']
    resources = []
    try:
        with transaction.commit_on_success():
            rf = ResourceFile.objects.create(project=project, file_name=file_name, kind=kind)
            for r in resource_ids:
                regex = r['regex'] if 'regex' in r else None
                tracking = int(r['tracking']) if 'tracking' in r else None
                resources.append(ResourceIdentifier.objects.create(resource_file=rf, resource_id=r['id'],
                                                                   character_regex=regex, tracking=tracking))
            if default_file is not None:
                default_variant = ResourceVariant.objects.create(resource_file=rf, variant=ResourceVariant.VARIANT_DEFAULT)
                default_variant.save_file(default_file, default_file.size)
            if colour_file is not None:
                colour_variant = ResourceVariant.objects.create(resource_file=rf, variant=ResourceVariant.VARIANT_COLOUR)
                colour_variant.save_file(colour_file, colour_file.size)


    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_create_file', data={
            'data': {
                'filename': file_name,
                'kind': 'resource',
                'resource-kind': kind
            }
        }, project=project, request=request)

        return json_response({"file": {
            "id": rf.id,
            "kind": rf.kind,
            "file_name": rf.file_name,
            "resource_ids": [{'id': x.resource_id, 'regex': x.character_regex} for x in resources],
            "identifiers": [x.resource_id for x in resources],
            "variants": [x.variant for x in rf.variants.all()],
            "extra": {y.resource_id: {'regex': y.character_regex, 'tracking': y.tracking} for y in rf.identifiers.all()}
        }})


@require_safe
@login_required
def resource_info(request, project_id, resource_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    resource = get_object_or_404(ResourceFile, pk=resource_id)
    resources = resource.get_identifiers()

    send_keen_event('cloudpebble', 'cloudpebble_open_file', data={
        'data': {
            'filename': resource.file_name,
            'kind': 'resource',
            'resource-kind': resource.kind
        }
    }, project=project, request=request)

    return json_response({
        'resource': {
            'resource_ids': [{
                                 'id': x.resource_id,
                                 'regex': x.character_regex,
                                 'tracking': x.tracking,
                                 'compatibility': x.compatibility
                             } for x in resources],
            'id': resource.id,
            'file_name': resource.file_name,
            'kind': resource.kind,
            "variants": [x.variant for x in resource.variants.all()],
            "extra": {y.resource_id: {'regex': y.character_regex, 'tracking': y.tracking, 'compatibility': y.compatibility} for y in resource.identifiers.all()}
        }
    })


@require_POST
@login_required
def delete_resource(request, project_id, resource_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    resource = get_object_or_404(ResourceFile, pk=resource_id, project=project)
    try:
        resource.delete()
    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_delete_file', data={
            'data': {
                'filename': resource.file_name,
                'kind': 'resource',
                'resource-kind': resource.kind
            }
        }, project=project, request=request)

        return json_response({})


@require_POST
@login_required
def update_resource(request, project_id, resource_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    resource = get_object_or_404(ResourceFile, pk=resource_id, project=project)
    resource_ids = json.loads(request.POST['resource_ids'])
    file_name = request.POST.get('file_name', None)
    try:
        with transaction.atomic():
            # Lazy approach: delete all the resource_ids and recreate them.
            # We could do better.
            resources = []
            ResourceIdentifier.objects.filter(resource_file=resource).delete()
            for r in resource_ids:
                regex = r['regex'] if 'regex' in r else None
                tracking = int(r['tracking']) if 'tracking' in r else None
                compat = r['compatibility'] if 'compatibility' in r else None
                resources.append(ResourceIdentifier.objects.create(resource_file=resource, resource_id=r['id'], character_regex=regex, tracking=tracking, compatibility=compat))

            if 'file' in request.FILES:
                default_variant = resource.variants.get_or_create(variant=ResourceVariant.VARIANT_DEFAULT)[0]
                default_variant.save_file(request.FILES['file'], request.FILES['file'].size)
            if 'file_colour' in request.FILES:
                colour_variant = resource.variants.get_or_create(variant=ResourceVariant.VARIANT_COLOUR)[0]
                colour_variant.save_file(request.FILES['file_colour'], request.FILES['file_colour'].size)

            if file_name and resource.file_name != file_name:
                resource.rename(file_name)
    except Exception as e:
        return json_failure(str(e))
    else:
        send_keen_event('cloudpebble', 'cloudpebble_save_file', data={
            'data': {
                'filename': resource.file_name,
                'kind': 'source'
            }
        }, project=project, request=request)

        return json_response({"file": {
            "id": resource.id,
            "kind": resource.kind,
            "file_name": resource.file_name,
            "resource_ids": [{'id': x.resource_id, 'regex': x.character_regex, 'compatibility': x.compatibility} for x in resources],
            "identifiers": [x.resource_id for x in resources],
            "variants": [x.variant for x in resource.variants.all()],
            "extra": {y.resource_id: {'regex': y.character_regex, 'tracking': y.tracking, 'compatibility': y.compatibility} for y in resource.identifiers.all()}
        }})


@require_safe
@login_required
def show_resource(request, project_id, resource_id, variant):
    resource = get_object_or_404(ResourceFile, pk=resource_id, project__owner=request.user)
    variant = resource.get_best_variant(variant)
    content_types = {
        u'png': 'image/png',
        u'png-trans': 'image/png',
        u'font': 'application/octet-stream',
        u'raw': 'application/octet-stream'
    }
    content_disposition = "attachment; filename=\"%s\"" % resource.file_name
    content_type = content_types[resource.kind]
    if settings.AWS_ENABLED:
        headers = {
            'response-content-disposition': content_disposition,
            'Content-Type': content_type
        }
        return HttpResponseRedirect(s3.get_signed_url('source', variant.s3_path, headers=headers))
    else:
        response = HttpResponse(open(variant.local_filename), content_type=content_type)
        response['Content-Disposition'] = content_disposition
        return response
