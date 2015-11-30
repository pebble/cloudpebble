import json
import re
from django.utils.translation import ugettext as _
from ide.models.files import ResourceFile, ResourceIdentifier

__author__ = 'katharine'


def generate_wscript_file_sdk2(project, for_export=False):
    jshint = project.app_jshint
    wscript = """
#
# This file is the default set of rules to compile a Pebble project.
#
# Feel free to customize this to your needs.
#

import os.path
try:
    from sh import CommandNotFound, jshint, cat, ErrorReturnCode_2
    hint = jshint
except (ImportError, CommandNotFound):
    hint = None

top = '.'
out = 'build'

def options(ctx):
    ctx.load('pebble_sdk')

def configure(ctx):
    ctx.load('pebble_sdk')
    global hint
    if hint is not None:
        hint = hint.bake(['--config', 'pebble-jshintrc'])

def build(ctx):
    if {{jshint}} and hint is not None:
        try:
            hint([node.abspath() for node in ctx.path.ant_glob("src/**/*.js")], _tty_out=False) # no tty because there are none in the cloudpebble sandbox.
        except ErrorReturnCode_2 as e:
            ctx.fatal("\\nJavaScript linting failed (you can disable this in Project Settings):\\n" + e.stdout)

    # Concatenate all our JS files (but not recursively), and only if any JS exists in the first place.
    ctx.path.make_node('src/js/').mkdir()
    js_paths = ctx.path.ant_glob(['src/*.js', 'src/**/*.js'])
    if js_paths:
        ctx(rule='cat ${SRC} > ${TGT}', source=js_paths, target='pebble-js-app.js')
        has_js = True
    else:
        has_js = False

    ctx.load('pebble_sdk')

    ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'),
                    target='pebble-app.elf')

    if os.path.exists('worker_src'):
        ctx.pbl_worker(source=ctx.path.ant_glob('worker_src/**/*.c'),
                        target='pebble-worker.elf')
        ctx.pbl_bundle(elf='pebble-app.elf',
                        worker_elf='pebble-worker.elf',
                        js='pebble-js-app.js' if has_js else [])
    else:
        ctx.pbl_bundle(elf='pebble-app.elf',
                       js='pebble-js-app.js' if has_js else [])

"""
    return wscript.replace('{{jshint}}', 'True' if jshint and not for_export else 'False')


def generate_wscript_file_sdk3(project, for_export):
    jshint = project.app_jshint
    wscript = """
    #
# This file is the default set of rules to compile a Pebble project.
#
# Feel free to customize this to your needs.
#

import os.path
try:
    from sh import CommandNotFound, jshint, cat, ErrorReturnCode_2
    hint = jshint
except (ImportError, CommandNotFound):
    hint = None

top = '.'
out = 'build'

def options(ctx):
    ctx.load('pebble_sdk')

def configure(ctx):
    ctx.load('pebble_sdk')

def build(ctx):
    if {{jshint}} and hint is not None:
        try:
            hint([node.abspath() for node in ctx.path.ant_glob("src/**/*.js")], _tty_out=False) # no tty because there are none in the cloudpebble sandbox.
        except ErrorReturnCode_2 as e:
            ctx.fatal("\\nJavaScript linting failed (you can disable this in Project Settings):\\n" + e.stdout)

    # Concatenate all our JS files (but not recursively), and only if any JS exists in the first place.
    ctx.path.make_node('src/js/').mkdir()
    js_paths = ctx.path.ant_glob(['src/*.js', 'src/**/*.js'])
    if js_paths:
        ctx(rule='cat ${SRC} > ${TGT}', source=js_paths, target='pebble-js-app.js')
        has_js = True
    else:
        has_js = False

    ctx.load('pebble_sdk')

    build_worker = os.path.exists('worker_src')
    binaries = []

    for p in ctx.env.TARGET_PLATFORMS:
        ctx.set_env(ctx.all_envs[p])
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf='{}/pebble-app.elf'.format(p)
        ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'),
        target=app_elf)

        if build_worker:
            worker_elf='{}/pebble-worker.elf'.format(p)
            binaries.append({'platform': p, 'app_elf': app_elf, 'worker_elf': worker_elf})
            ctx.pbl_worker(source=ctx.path.ant_glob('worker_src/**/*.c'),
            target=worker_elf)
        else:
            binaries.append({'platform': p, 'app_elf': app_elf})

    ctx.set_group('bundle')
    ctx.pbl_bundle(binaries=binaries, js='pebble-js-app.js' if has_js else [])
    """
    return wscript.replace('{{jshint}}', 'True' if jshint and not for_export else 'False')


def generate_wscript_file(project, for_export=False):
    if project.sdk_version == '2':
        return generate_wscript_file_sdk2(project, for_export)
    elif project.sdk_version == '3':
        return generate_wscript_file_sdk3(project, for_export)


def generate_jshint_file(project):
    return """
/*
 * Example jshint configuration file for Pebble development.
 *
 * Check out the full documentation at http://www.jshint.com/docs/options/
 */
{
  // Declares the existence of the globals available in PebbleKit JS.
  "globals": {
    "Pebble": true,
    "console": true,
    "XMLHttpRequest": true,
    "navigator": true, // For navigator.geolocation
    "localStorage": true,
    "setTimeout": true,
    "setInterval": true,
    "Int8Array": true,
    "Uint8Array": true,
    "Uint8ClampedArray": true,
    "Int16Array": true,
    "Uint16Array": true,
    "Int32Array": true,
    "Uint32Array": true,
    "Float32Array": true,
    "Float64Array": true
  },

  // Do not mess with standard JavaScript objects (Array, Date, etc)
  "freeze": true,

  // Do not use eval! Keep this warning turned on (ie: false)
  "evil": false,

  /*
   * The options below are more style/developer dependent.
   * Customize to your liking.
   */

  // All variables should be in camelcase - too specific for CloudPebble builds to fail
  // "camelcase": true,

  // Do not allow blocks without { } - too specific for CloudPebble builds to fail.
  // "curly": true,

  // Prohibits the use of immediate function invocations without wrapping them in parentheses
  "immed": true,

  // Don't enforce indentation, because it's not worth failing builds over
  // (especially given our somewhat lacklustre support for it)
  "indent": false,

  // Do not use a variable before it's defined
  "latedef": "nofunc",

  // Spot undefined variables
  "undef": "true",

  // Spot unused variables
  "unused": "true"
}
"""


def generate_manifest(project, resources):
    if project.project_type == 'native':
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
        'capabilities': project.app_capabilities.split(','),
        'projectType': 'native',
        'sdkVersion': "2",
    }
    if project.app_is_shown_on_communication:
        manifest['watchapp']['onlyShownOnCommunication'] = project.app_is_shown_on_communication
    return manifest


def generate_v3_manifest_dict(project, resources):
    # Just extend the v2 one.
    manifest = generate_v2_manifest_dict(project, resources)
    if project.app_platforms:
        manifest['targetPlatforms'] = project.app_platform_list
    if project.app_is_hidden:
        manifest['watchapp']['hiddenApp'] = project.app_is_hidden
    manifest['sdkVersion'] = "3"
    del manifest['versionCode']
    return manifest


def generate_manifest_dict(project, resources):
    if project.project_type == 'native':
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


def generate_resource_map(project, resources):
    return dict_to_pretty_json(generate_resource_dict(project, resources))


def dict_to_pretty_json(d):
    return json.dumps(d, indent=4, separators=(',', ': '), sort_keys=True) + "\n"


def generate_resource_dict(project, resources):
    if project.project_type == 'native':
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
            "type": "png",
            "name": "IMAGE_MENU_ICON",
            "file": "images/menu_icon.png"
        }, {
            "type": "png",
            "name": "IMAGE_LOGO_SPLASH",
            "file": "images/logo_splash.png"
        }, {
            "type": "png",
            "name": "IMAGE_TILE_SPLASH",
            "file": "images/tile_splash.png"
        }, {
            "type": "font",
            "name": "MONO_FONT_14",
            "file": "fonts/UbuntuMono-Regular.ttf"
        }
    ]

    for resource in resources:
        if resource.kind != 'png':
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
        "targetPlatforms": ["aplite", "basalt"],
        "appKeys": {},
        "resources": generate_pebblejs_resource_dict(resources),
        "projectType": "pebblejs",
        "sdkVersion": "3",
    }

    return manifest
