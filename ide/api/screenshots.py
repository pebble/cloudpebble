import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse, HttpResponseRedirect
from django.db import transaction
from django.views.decorators.http import require_POST, require_safe
from django.core.urlresolvers import reverse
from utils.td_helper import send_td_event

from ide.api import json_failure, json_response
from ide.models.project import Project
from ide.models.monkey import TestFile, ScreenshotSet, ScreenshotFile
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

    send_td_event('cloudpebble_load_screenshots', data={'data': {
        'test': test.id
    }}, project=project, request=request)

    return json_response({"screenshots": [make_screenshot_dict(screenshot, project_id) for screenshot in screenshots]})

@require_POST
@login_required
def sync_screenshots(request, project_id, test_id):
    """ Synchronise screenshots between the client and server
    Takes a JSON parameter 'screenshots'. An example:
    [
      {
        "name": "one",
        "id": 2
        "files": {
          "chalk": {"id": 5},
          "basalt": {"id": 2}
        },
      }, {
        "name": "two",
        "files": {"basalt": {"uploadId": 0}}
      }
    ]
    - Chalk and basalt screenshots for one.png are kept
    - A new screenshot for "two.png" is uploaded, using the first uploaded file
    - Any other screenshots are deleted.
    """

    project = get_object_or_404(Project, pk=project_id, owner=request.user)
    screenshot_data = json.loads(request.POST['screenshots'])
    uploaded_files = request.FILES.getlist('files[]')

    test = get_object_or_404(TestFile, pk=test_id)
    current_screenshot_sets = test.screenshot_sets.all()
    # Get the list of screenshot set IDs
    deleted_screenshot_set_ids = [shot.id for shot in current_screenshot_sets]
    try:
        with transaction.atomic():
            # Go through uploaded screenshot sets
            for screenshot_set_info in screenshot_data:
                # If uploaded screenshot set has an ID, mark it as not deleted and update it
                screenshot_set_id = screenshot_set_info.get('id', None)
                if screenshot_set_id:
                    deleted_screenshot_set_ids.remove(screenshot_set_id)
                    screenshot_set = get_object_or_404(ScreenshotSet, pk=screenshot_set_id)
                    # Set a new name
                    screenshot_set.name = screenshot_set_info['name']
                    # Delete any removed or replaced screenshot files
                    for screenshot_file in screenshot_set.files.all():
                        if screenshot_file.platform not in screenshot_set_info['files']:
                            screenshot_file.delete()
                        elif screenshot_set_info['files'][screenshot_file.platform].get('uploadId', None) is not None:
                            screenshot_file.delete()
                else:
                    # Create a new ScreenshotSet if no ID was given
                    screenshot_set = ScreenshotSet.objects.create(test=test, name=screenshot_set_info['name'])
                screenshot_set.save()

                # Add new uploads
                for platform, upload_info in screenshot_set_info['files'].iteritems():
                    uploadId = upload_info.get('uploadId', None)
                    if isinstance(uploadId, int):
                        screenshot_file, did_create = ScreenshotFile.objects.get_or_create(screenshot_set=screenshot_set, platform=platform)
                        posted_file = uploaded_files[uploadId]
                        if posted_file.content_type != "image/png":
                            raise ValueError("Screenshots must be PNG files")
                        screenshot_file.save()
                        screenshot_file.save_file(posted_file, posted_file.size)

                screenshot_set.save()

            # Delete all screenshot sets missing from POST request
            for screenshot in current_screenshot_sets:
                if screenshot.id in deleted_screenshot_set_ids:
                    screenshot.delete()
    except (FloatingPointError, ValueError) as e:
        return json_failure(e)
    else:
        current_screenshot_sets = ScreenshotSet.objects.filter(test=test)
        return json_response({"screenshots": [make_screenshot_dict(screenshot, project_id) for screenshot in current_screenshot_sets]})

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
