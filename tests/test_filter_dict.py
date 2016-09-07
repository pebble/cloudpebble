from unittest import TestCase

from utils.filter_dict import filter_dict, TransformValue, TransformKeyAndValue


class TestFilterDict(TestCase):
    def test_filter_toplevel_keys(self):
        """ Test that we can filter keys at the top level of a dict """
        before = {'key': 'value', 'filter_me': 'filter_me'}
        after = {'key': 'value'}
        spec = {'key': True}
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_filter_sub_keys(self):
        """ Test that we can filter keys in lower levels of a dict """
        before = {
            'sublevel': {
                'key': 'value',
                'filter_me': 'filter_me'
            },
            'filter_me': 'filter_me'
        }
        after = {'sublevel': {'key': 'value'}}
        spec = {'sublevel': {'key': True}}
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_value_callback(self):
        """ Test that we can use a callback to transform a dict's values """
        before = {
            'numbers': [1, 5, 'a'],
        }
        after = {
            'numbers': [2, 10, 'aa'],
        }
        spec = {
            'numbers': TransformValue(lambda v: [x * 2 for x in v])
        }
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_invalid_dictionary_type(self):
        """ Test that the function fails if the 'dictionary' is not a Mappable """
        with self.assertRaises(ValueError):
            print filter_dict('a_string', {})

    def test_invalid_spec_type(self):
        """ Test that the function fails if the spec is not a Mappable """
        with self.assertRaises(ValueError):
            print filter_dict({}, 'a_string')

    def test_wildcard_with_callback(self):
        """ Test that transformations are applied for wildcard keys"""
        before = {
            'a': 1,
            'b': 2
        }
        after = {
            'a': 2,
            'b': 3
        }
        spec = {True: TransformValue(lambda x: x + 1)}
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_wildcard_values(self):
        """ Test that 'True:True: simply copies a dictionary """
        before = {
            'a': 1,
            'b': {'c': 2}
        }
        after = before
        spec = {True: True}
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_wildcard_multilevel(self):
        """ Test that dicts inside wildcard keys are filtered """
        before = {
            'a': {'filter_me': 'filter_me'},
            'b': {'key': 'value', 'filter_me': 'filter_me'},
            'c': 'value'
        }
        after = {
            'a': {},
            'b': {'key': 'value'},
            'c': 'value'
        }
        spec = {True: {
            'key': True
        }}
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_transform_key_and_value(self):
        """ Test that TransformKeyAndValue can rename a key and its value """
        before = {
            'a': 'change_me',
            'b': 'filter_me',
            'c': 'keep_me'
        }
        after = {
            'newkey': 'change_me_changed',
            'c': 'keep_me'
        }
        spec = {
            'a': TransformKeyAndValue(lambda x: ('newkey', x + '_changed')),
            'c': True,
        }
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_rename(self):
        """ Check that string values in the spec can rename a key. """
        before = {'a': 'thing'}
        after = {'b': 'thing'}
        spec = {'a': 'b'}
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_wildcard_with_siblings(self):
        before = {
            'a': 'value',
            'b': {
                'key': 'value',
                'another': 'filterme'
            },
            'c': {
                'another': 'dontfilter'
            }
        }
        after = {
            'a': 'value',
            'b': {
                'key': 'value'
            },
            'c': {
                'another': 'dontfilter'
            }
        }
        spec = {
            True: True,
            'b': {
                'key': True
            }
        }
        self.assertDictEqual(filter_dict(before, spec), after)

    def test_wildcard_omission_with_false_value(self):
        """ Test that a False value can be used to exclude something from a wildcard. """
        before = {
            'a': 'value',
            'b': 'value',
            'c': 'filter_me',
            'd': 'filter_me'
        }
        after = {
            'a': 'value',
            'b': 'value',
        }
        spec = {
            True: True,
            'c': False,
            'd': False
        }
        self.assertDictEqual(filter_dict(before, spec), after)
