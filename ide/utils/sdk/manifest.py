import json
import re
import uuid

from django.utils.translation import ugettext as _

from ide.utils.project import APPINFO_MANIFEST, PACKAGE_MANIFEST, InvalidProjectArchiveException

__author__ = 'katharine'


def manifest_name_for_project(project):
    if project.is_standard_project_type and project.sdk_version == '3':
        return PACKAGE_MANIFEST
    else:
        return APPINFO_MANIFEST


def generate_manifest(project, resources):
    if project.is_standard_project_type:
        if project.sdk_version == '2':
            return generate_v2_manifest(project, resources)
        else:
            return generate_v3_manifest(project, resources)
    elif project.project_type == 'pebblejs':
        return generate_pebblejs_manifest(project, resources)
    elif project.project_type == 'simplyjs':
        return generate_simplyjs_manifest(project)
    else:
        raise Exception(_("Unknown project type %s") % project.project_type)


def generate_v2_manifest(project, resources):
    return dict_to_pretty_json(generate_v2_manifest_dict(project, resources))


def generate_v3_manifest(project, resources):
    return dict_to_pretty_json(generate_v3_manifest_dict(project, resources))


def generate_v2_manifest_dict(project, resources):
    manifest = {
        'uuid': str(project.app_uuid),
        'shortName': project.app_short_name,
        'longName': project.app_long_name,
        'companyName': project.app_company_name,
        'versionLabel': project.app_version_label,
        'versionCode': 1,
        'watchapp': {
            'watchface': project.app_is_watchface
        },
        'appKeys': json.loads(project.app_keys),
        'resources': generate_resource_dict(project, resources),
        'projectType': 'native',
        'sdkVersion': "2",
    }
    if project.app_capabilities:
        manifest['capabilities'] = project.app_capabilities.split(',')
    if project.app_is_shown_on_communication:
        manifest['watchapp']['onlyShownOnCommunication'] = project.app_is_shown_on_communication
    return manifest


def generate_v3_manifest_dict(project, resources):
    manifest = {
        'name': project.npm_name,
        'author': project.app_company_name,
        'version': project.semver,
        'keywords': project.keywords,
        'dependencies': project.get_dependencies(),
        'pebble': {
            'sdkVersion': project.sdk_version,
            'watchapp': {
                'watchface': project.app_is_watchface
            },
            'messageKeys': json.loads(project.app_keys),
            'resources': generate_resource_dict(project, resources),
            'projectType': project.project_type
        }
    }
    if project.app_capabilities:
        manifest['pebble']['capabilities'] = project.app_capabilities.split(',')
    if project.project_type == 'package':
        manifest['files'] = ['dist.zip']
    else:
        manifest['pebble']['uuid'] = str(project.app_uuid)
        manifest['pebble']['enableMultiJS'] = project.app_modern_multi_js
        manifest['pebble']['displayName'] = project.app_long_name
        if project.app_is_hidden:
            manifest['pebble']['watchapp']['hiddenApp'] = project.app_is_hidden
    if project.app_platforms:
        manifest['pebble']['targetPlatforms'] = project.app_platform_list
    return manifest


def generate_manifest_dict(project, resources):
    if project.is_standard_project_type:
        if project.sdk_version == '2':
            return generate_v2_manifest_dict(project, resources)
        else:
            return generate_v3_manifest_dict(project, resources)
    elif project.project_type == 'simplyjs':
        return generate_simplyjs_manifest_dict(project)
    elif project.project_type == 'pebblejs':
        return generate_pebblejs_manifest_dict(project, resources)
    else:
        raise Exception(_("Unknown project type %s") % project.project_type)

def dict_to_pretty_json(d):
    return json.dumps(d, indent=4, separators=(',', ': '), sort_keys=True) + "\n"


def generate_resource_dict(project, resources):
    if project.is_standard_project_type:
        return generate_native_resource_dict(project, resources)
    elif project.project_type == 'simplyjs':
        return generate_simplyjs_resource_dict()
    elif project.project_type == 'pebblejs':
        return generate_pebblejs_resource_dict(resources)
    else:
        raise Exception(_("Unknown project type %s") % project.project_type)


def generate_native_resource_dict(project, resources):
    resource_map = {'media': []}
    for resource in resources:
        for resource_id in resource.get_identifiers():
            d = {
                'type': resource.kind,
                'file': resource.root_path,
                'name': resource_id.resource_id,
            }
            if resource_id.character_regex:
                d['characterRegex'] = resource_id.character_regex
            if resource_id.tracking:
                d['trackingAdjust'] = resource_id.tracking
            if resource_id.memory_format:
                d['memoryFormat'] = resource_id.memory_format
            if resource_id.storage_format:
                d['storageFormat'] = resource_id.storage_format
            if resource_id.space_optimisation:
                d['spaceOptimization'] = resource_id.space_optimisation
            if resource.is_menu_icon:
                d['menuIcon'] = True
            if resource_id.compatibility is not None:
                d['compatibility'] = resource_id.compatibility
            if project.sdk_version == '3' and resource_id.target_platforms:
                d['targetPlatforms'] = json.loads(resource_id.target_platforms)

            resource_map['media'].append(d)
    return resource_map


def generate_simplyjs_resource_dict():
    return {
        "media": [
            {
                "menuIcon": True,
                "type": "png",
                "name": "IMAGE_MENU_ICON",
                "file": "images/menu_icon.png"
            }, {
                "type": "png",
                "name": "IMAGE_LOGO_SPLASH",
                "file": "images/logo_splash.png"
            }, {
                "type": "font",
                "name": "MONO_FONT_14",
                "file": "fonts/UbuntuMono-Regular.ttf"
            }
        ]
    }


def generate_pebblejs_resource_dict(resources):
    media = [
        {
            "menuIcon": True,  # This must be the first entry; we adjust it later.
            "type": "bitmap",
            "name": "IMAGE_MENU_ICON",
            "file": "images/menu_icon.png"
        }, {
            "type": "bitmap",
            "name": "IMAGE_LOGO_SPLASH",
            "file": "images/logo_splash.png"
        }, {
            "type": "bitmap",
            "name": "IMAGE_TILE_SPLASH",
            "file": "images/tile_splash.png"
        }, {
            "type": "font",
            "name": "MONO_FONT_14",
            "file": "fonts/UbuntuMono-Regular.ttf"
        }
    ]

    for resource in resources:
        if resource.kind not in ('bitmap', 'png'):
            continue

        d = {
            'type': resource.kind,
            'file': resource.root_path,
            'name': re.sub(r'[^A-Z0-9_]', '_', resource.root_path.upper()),
        }
        if resource.is_menu_icon:
            d['menuIcon'] = True
            del media[0]['menuIcon']

        media.append(d)

    return {
        'media': media
    }


def generate_simplyjs_manifest(project):
    return dict_to_pretty_json(generate_simplyjs_manifest_dict(project))


def generate_simplyjs_manifest_dict(project):
    manifest = {
        "uuid": project.app_uuid,
        "shortName": project.app_short_name,
        "longName": project.app_long_name,
        "companyName": project.app_company_name,
        "versionLabel": project.app_version_label,
        "versionCode": 1,
        "capabilities": project.app_capabilities.split(','),
        "watchapp": {
            "watchface": project.app_is_watchface
        },
        "appKeys": {},
        "resources": generate_simplyjs_resource_dict(),
        "projectType": "simplyjs"
    }
    return manifest


def generate_pebblejs_manifest(project, resources):
    return dict_to_pretty_json(generate_pebblejs_manifest_dict(project, resources))


def generate_pebblejs_manifest_dict(project, resources):
    manifest = {
        "uuid": project.app_uuid,
        "shortName": project.app_short_name,
        "longName": project.app_long_name,
        "companyName": project.app_company_name,
        "versionLabel": project.app_version_label,
        "capabilities": project.app_capabilities.split(','),
        "versionCode": 1,
        "watchapp": {
            "watchface": project.app_is_watchface,
            'hiddenApp': project.app_is_hidden
        },
        "appKeys": {},
        "resources": generate_pebblejs_resource_dict(resources),
        "projectType": "pebblejs",
        "sdkVersion": "3",
    }
    if project.app_platforms:
        manifest["targetPlatforms"] = project.app_platform_list

    return manifest


def load_manifest_dict(manifest, manifest_kind, default_project_type='native'):
    """ Load data from a manifest dictionary
    :param manifest: a dictionary of settings
    :param manifest_kind: 'package.json' or 'appinfo.json'
    :return: a tuple of (models.Project options dictionary, the media map, the dependencies dictionary)
    """
    project = {}
    dependencies = {}
    if manifest_kind == APPINFO_MANIFEST:
        project['app_short_name'] = manifest['shortName']
        project['app_long_name'] = manifest['longName']
        project['app_company_name'] = manifest['companyName']
        project['app_version_label'] = manifest['versionLabel']
        project['app_keys'] = dict_to_pretty_json(manifest.get('appKeys', {}))
        project['sdk_version'] = manifest.get('sdkVersion', '2')
        project['app_modern_multi_js'] = manifest.get('enableMultiJS', False)

    elif manifest_kind == PACKAGE_MANIFEST:
        project['app_short_name'] = manifest['name']
        project['app_company_name'] = manifest['author']
        project['semver'] = manifest['version']
        project['app_long_name'] = manifest['pebble'].get('displayName', None)
        project['app_keys'] = dict_to_pretty_json(manifest['pebble'].get('messageKeys', []))
        project['keywords'] = manifest.get('keywords', [])
        dependencies = manifest.get('dependencies', {})
        manifest = manifest['pebble']
        project['app_modern_multi_js'] = manifest.get('enableMultiJS', True)
        project['sdk_version'] = manifest.get('sdkVersion', '3')
    else:
        raise InvalidProjectArchiveException(_('Invalid manifest kind: %s') % manifest_kind[-12:])

    project['app_uuid'] = manifest.get('uuid', uuid.uuid4())
    project['app_is_watchface'] = manifest.get('watchapp', {}).get('watchface', False)
    project['app_is_hidden'] = manifest.get('watchapp', {}).get('hiddenApp', False)
    project['app_is_shown_on_communication'] = manifest.get('watchapp', {}).get('onlyShownOnCommunication', False)
    project['app_capabilities'] = ','.join(manifest.get('capabilities', []))

    if 'targetPlatforms' in manifest:
        project['app_platforms'] = ','.join(manifest['targetPlatforms'])
    if 'resources' in manifest and 'media' in manifest['resources']:
        media_map = manifest['resources']['media']
    else:
        media_map = {}
    project['project_type'] = manifest.get('projectType', default_project_type)
    return project, media_map, dependencies
