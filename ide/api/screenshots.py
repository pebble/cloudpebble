import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse, HttpResponseRedirect
from django.db import transaction
from django.views.decorators.http import require_POST, require_safe
from django.core.urlresolvers import reverse
from utils.keen_helper import send_keen_event

from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.monkey import TestFile, ScreenshotSet, ScreenshotFile, ScreenshotSet, ScreenshotFile
import utils.s3 as s3

__author__ = 'joe'

def make_screenshot_dict(screenshot_set, project_id):
    return {
        "name": screenshot_set.name,
        "id": screenshot_set.id,
        "files": dict([(screenshot_file.platform, {
            "id": screenshot_file.id,
            # "src": "project/%s/screenshot/%s" % (project_id, screenshot_file.id)
            "src": reverse('ide:show_screenshot', kwargs={
                'project_id': project_id,
                'test_id': screenshot_set.test.id,
                'screenshot_id': screenshot_set.id,
                'platform_name': screenshot_file.platform
            })
        }) for screenshot_file in screenshot_set.files.all()])
    }

@require_safe
@login_required
def load_screenshots(request, project_id, test_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    test = get_object_or_404(TestFile, pk=test_id)
    screenshots = test.screenshot_sets.all()

    send_keen_event('cloudpebble', 'cloudpebble_load_screenshots', data={'data': {
        'test': test.id
    }}, project=project, request=request)

    return json_response({"screenshots": [make_screenshot_dict(screenshot, project_id) for screenshot in screenshots]})

@require_POST
@login_required
def save_screenshots(request, project_id, test_id):
    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    screenshot_data = json.loads(request.POST['screenshots'])
    uploaded_files = request.FILES.getlist('files[]')

    test = get_object_or_404(TestFile, pk=test_id)
    screenshots = test.screenshot_sets.all()
    # get set of screenshot IDs
    deleted_ids = [shot.id for shot in screenshots]
    try:
        with transaction.atomic():
            # go through uploaded screenshots
            for screenshot_info in screenshot_data:
                # if uploaded screenshot has an ID
                id = screenshot_info.get('id', None)
                if id:
                    # Remove ID from set
                    deleted_ids.remove(id)
                    # Fetch the screenshot
                    screenshot_set = get_object_or_404(ScreenshotSet, pk=id)
                    # edit name
                    screenshot_set.name = screenshot_info['name']
                    # delete removed or re-uploaded screenshot files
                    files = screenshot_set.files.all()
                    for screenshot_file in files:
                        was_deleted = lambda: screenshot_file.platform not in screenshot_info['files']
                        is_replaced = lambda: screenshot_info['files'][screenshot_file.platform].get('uploadId', None) is not None
                        if was_deleted() or is_replaced():
                            screenshot_file.delete()
                else:
                    # create a new ScreenshotSet
                    screenshot_set = ScreenshotSet.objects.create(test=test, name=screenshot_info['name'])
                screenshot_set.save()

                # add new uploads
                for platform, upload_info in screenshot_info['files'].iteritems():
                    uploadId = upload_info.get('uploadId', None)
                    if isinstance(uploadId, int):
                        screenshot_file, did_create = ScreenshotFile.objects.get_or_create(screenshot_set=screenshot_set, platform=platform)
                        posted_file = uploaded_files[uploadId]
                        if posted_file.content_type != "image/png":
                            raise ValueError("Screenshots must be PNG files")
                        screenshot_file.save()
                        screenshot_file.save_file(posted_file, posted_file.size)

                screenshot_set.save()

            # delete all screenshots missing from POST request
            for screenshot in screenshots:
                if screenshot.id in deleted_ids:
                    screenshot.delete()
    except (FloatingPointError, ValueError) as e:
        return json_failure(str(e))
    else:
        screenshots = ScreenshotSet.objects.filter(test=test)
        return json_response({"screenshots": [make_screenshot_dict(screenshot, project_id) for screenshot in screenshots]})

@require_safe
@login_required
def show_screenshot(request, project_id, test_id, screenshot_id, platform_name):
    screenshot_set = get_object_or_404(ScreenshotSet, pk=screenshot_id, test__project__owner=request.user)
    screenshot_file = get_object_or_404(ScreenshotFile, platform=platform_name, screenshot_set=screenshot_set)
    file_name = screenshot_set.name+".png"
    content_type = 'image/png'
    content_disposition = "attachment; filename=\"%s\"" % file_name

    if settings.AWS_ENABLED:
        headers = {
            'response-content-disposition': content_disposition,
            'Content-Type': content_type
        }
        return HttpResponseRedirect(s3.get_signed_url('source', screenshot_file.s3_path, headers=headers))
    else:
        response = StreamingHttpResponse(open(screenshot_file.local_filename), content_type=content_type)
        response['Content-Disposition'] = content_disposition
        return response
