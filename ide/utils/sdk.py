import json

__author__ = 'katharine'


def generate_wscript_file(project, for_export=False):
    jshint = project.app_jshint
    wscript = """
#
# This file is the default set of rules to compile a Pebble project.
#
# Feel free to customize this to your needs.
#

try:
    from sh import jshint, ErrorReturnCode_2
    hint = jshint
except ImportError:
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
            hint("src/js/pebble-js-app.js", _tty_out=False) # no tty because there are none in the cloudpebble sandbox.
        except ErrorReturnCode_2 as e:
            ctx.fatal("\\nJavaScript linting failed (you can disable this in Project Settings):\\n" + e.stdout)

    ctx.load('pebble_sdk')

    ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'),
                    target='pebble-app.elf')

    ctx.pbl_bundle(elf='pebble-app.elf',
                   js=ctx.path.ant_glob('src/js/**/*.js'))

"""
    return wscript.replace('{{jshint}}', 'True' if jshint and not for_export else 'False')


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
    "setTimeout": true
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


def generate_v2_manifest(project, resources):
    return dict_to_pretty_json(generate_v2_manifest_dict(project, resources))


def generate_v2_manifest_dict(project, resources):
    manifest = {
        'uuid': str(project.app_uuid),
        'shortName': project.app_short_name,
        'longName': project.app_long_name,
        'companyName': project.app_company_name,
        'versionCode': project.app_version_code,
        'versionLabel': project.app_version_label,
        'watchapp': {
            'watchface': project.app_is_watchface
        },
        'appKeys': json.loads(project.app_keys),
        'resources': generate_resource_dict(project, resources),
        'capabilities': project.app_capabilities.split(',')
    }
    return manifest


def generate_resource_map(project, resources):
    return dict_to_pretty_json(generate_resource_dict(project, resources))


def dict_to_pretty_json(d):
    return json.dumps(d, indent=4, separators=(',', ': ')) + "\n"


def generate_resource_dict(project, resources):
    resource_map = {'media': []}
    if project.sdk_version == '1':
        resource_map['friendlyVersion'] = 'VERSION'
        resource_map['versionDefName'] = project.version_def_name

    if project.sdk_version == '1' and len(resources) == 0:
        print "No resources; adding dummy."
        resource_map['media'].append({"type": "raw", "defName": "DUMMY", "file": "resource_map.json"})
    else:
        for resource in resources:
            for resource_id in resource.get_identifiers():
                d = {
                    'type': resource.kind,
                    'file': resource.path
                }
                if project.sdk_version == '1':
                    d['defName'] = resource_id.resource_id
                else:
                    d['name'] = resource_id.resource_id
                if resource_id.character_regex:
                    d['characterRegex'] = resource_id.character_regex
                if resource_id.tracking:
                    d['trackingAdjust'] = resource_id.tracking
                if resource.is_menu_icon:
                    d['menuIcon'] = True
                resource_map['media'].append(d)
    return resource_map


def generate_simplyjs_manifest_dict(project):
    manifest = {
        "uuid": project.app_uuid,
        "shortName": project.app_short_name,
        "longName": project.app_long_name,
        "companyName": project.app_company_name,
        "versionCode": project.app_version_code,
        "versionLabel": project.app_version_label,
        "capabilities": project.app_capabilities.split(','),
        "watchapp": {
            "watchface": project.app_is_watchface
        },
        "appKeys": {},
        "resources": {
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
    }
    return manifest
