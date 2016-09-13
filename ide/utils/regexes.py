from django.core.validators import RegexValidator


class RegexHolder(object):
    regex_dictionary = {
        # Match major[.minor], where major and minor are numbers between 0 and 255 with no leading 0s
        'sdk_version': r'^(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])(\.(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5]))?$',

        # Match x.y.z, each a number between 0 and 255 with no leading 0s
        'semver': r'^(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])\.(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])\.(0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])$',

        # Match a string of letters and numbers separated with underscores but not starting with a digit
        'c_identifier': r'^\w+$',

        # Match a C identifier optionally followed by an [array index]
        'c_identifier_with_index': r'^(\w+)(?:\[(\d+)\])?$',

        # Match a UUID4
        'uuid': r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',

        # Match a valid resource file name
        'resource_file_name': r'^[/a-zA-Z0-9_(). -]+$',

        # Match a valid c/h/js file name
        'source_file_name': r'^[/a-zA-Z0-9_.-]+\.(c|h|js|json)$'
    }

    def validator(self, key, message):
        return [RegexValidator(self.regex_dictionary[key], message=message)]

    def __getattr__(self, key):
        return self.regex_dictionary[key.lower()]


regexes = RegexHolder()
