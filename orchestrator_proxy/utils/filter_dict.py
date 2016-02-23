import collections


def filter_dict(dictionary, spec):
    """ Return a dictionary with whitelisted keys only.
    :param dictionary: Object to filter
    :param spec: Specification of keys to filter. The structure of the spec dictionary defines the structure of the output dictionary.
        - Any keys in the spec with a value of "True" represent a value which is copied over
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
    if spec.keys() == [True]:
        # Wildcard case
        spec_value = spec[True]
        for key in dictionary:
            out[key] = _transform_value(spec_value, dictionary[key], strict=False)
    else:
        # Non-wildcard case
        for key, spec_value in spec.iteritems():
            if key in dictionary:
                out[key] = _transform_value(spec_value, dictionary[key], strict=True)
    return out


def _transform_value(spec_value, v, strict):
    if spec_value is True:
        return v
    elif callable(spec_value):
        return spec_value(v)
    elif isinstance(spec_value, collections.Mapping):
        return _filter_dict(v, spec_value, strict=strict)
    else:
        raise ValueError('Invalid filter spec value')
