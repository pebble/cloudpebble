import collections

__author__ = 'joe'


class _Transform(object):
    def __init__(self, func):
        assert callable(func)
        self.func = func

    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)


class TransformValue(_Transform):
    pass


class TransformKeyAndValue(_Transform):
    def __call__(self, *args, **kwargs):
        v = self.func(*args, **kwargs)
        assert isinstance(v, tuple)
        assert len(v) == 2, "Transform function must return a tuple of (key, value)"
        return v


def filter_dict(dictionary, spec):
    """ Return a dictionary with whitelisted keys only.
    :param dictionary: Object to filter
    :param spec: Specification of keys to filter. The structure of the spec dictionary defines the structure of the output dictionary.
        - Any keys in the spec with a value of "True" represent a value which is copied over
        - Any keys in the spec which are strings will rename the key to the string
        - For any keys in the spec with callable values, the output value is mapped by the function
        - For any keys in the spec with dictionary values, the dictionary represents the spec of a sub-dictionary
        - If a key itself is True, it is a wildcard for all keys
    :return: Filtered dictionary
    """
    return _filter_dict(dictionary, spec, strict=True)


def _filter_dict(dictionary, spec, strict=False):
    if not isinstance(dictionary, collections.Mapping):
        if not strict:
            return dictionary
        else:
            raise ValueError('First argument must be a collections.Mappable')
    if not isinstance(spec, collections.Mapping):
        raise ValueError('Second argument must be a collections.Mappable')

    out = {}
    if True in spec.keys():
        # Wildcard case
        for key in dictionary:
            spec_value = spec.get(key, spec[True])
            _transform_value(out, key, dictionary, spec_value, strict=False)
    else:
        # Non-wildcard case
        for key, spec_value in spec.iteritems():
            if key in dictionary:
                _transform_value(out, key, dictionary, spec_value, strict=True)
    return out


def _transform_value(out, key, dictionary, spec_value, strict):
    v = dictionary[key]
    if spec_value is False:
        return
    if spec_value is True:
        out[key] = v
    elif isinstance(spec_value, TransformValue):
        out[key] = spec_value(v)
    elif isinstance(spec_value, TransformKeyAndValue):
        result = spec_value(v)
        out[result[0]] = result[1]
    elif isinstance(spec_value, collections.Mapping):
        out[key] = _filter_dict(v, spec_value, strict=strict)
    elif isinstance(spec_value, basestring):
        out[spec_value] = v
    else:
        raise ValueError('Invalid filter spec value')
