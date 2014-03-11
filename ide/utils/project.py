__author__ = 'katharine'


def find_project_root(contents):
    RESOURCE_MAP = 'resources/src/resource_map.json'
    MANIFEST = 'appinfo.json'
    SRC_DIR = 'src/'
    version = None
    for base_dir in contents:
        version = None
        print base_dir
        # Try finding v2
        try:
            dir_end = base_dir.index(MANIFEST)
            print dir_end
        except ValueError:
            # Try finding v1
            try:
                dir_end = base_dir.index(RESOURCE_MAP)
            except ValueError:
                continue
            else:
                if dir_end + len(RESOURCE_MAP) != len(base_dir):
                    continue
                version = '1'
        else:
            if dir_end + len(MANIFEST) != len(base_dir):
                print 'failed'
                continue
            version = '2'

        base_dir = base_dir[:dir_end]
        print base_dir
        for source_dir in contents:
            if source_dir[:dir_end] != base_dir:
                continue
            if source_dir[-2:] != '.c':
                continue
            if source_dir[dir_end:dir_end+len(SRC_DIR)] != SRC_DIR:
                continue
            break
        else:
            continue
        break
    else:
        raise Exception("No project root found.")
    return (version, base_dir)