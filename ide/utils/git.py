import base64
import hashlib

__author__ = 'katharine'


def git_sha(content):
    return hashlib.sha1('blob %d\x00%s' % (len(content), content)).hexdigest()


def git_blob(repo, sha):
    return base64.b64decode(repo.get_git_blob(sha).content)