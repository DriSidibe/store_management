"""Signed, expiring links for camera media.

<img> and <video> tags can't send the API's auth header, so the API hands
authenticated users links carrying a signed token instead. Camera files are
not reachable under /media (nginx only serves product images there)."""
import os

from django.conf import settings
from django.core import signing

MEDIA_SALT = 'camera-media'
MEDIA_MAX_AGE = 6 * 3600
FEED_SALT = 'camera-feed'
FEED_MAX_AGE = 12 * 3600


def signed_media_url(relative_path):
    """Link to a file under MEDIA_ROOT (e.g. 'motioneye/Camera1/2026-09-26/x.jpg')."""
    token = signing.dumps(relative_path, salt=MEDIA_SALT, compress=True)
    return f'/api/camera/media/?t={token}'


def resolve_media_token(token):
    """Returns (relative_path, absolute_path) for a valid token, or raises
    signing.BadSignature / FileNotFoundError."""
    relative = signing.loads(token or '', salt=MEDIA_SALT, max_age=MEDIA_MAX_AGE)
    root = os.path.realpath(settings.MEDIA_ROOT)
    full = os.path.realpath(os.path.join(root, relative))
    if not full.startswith(root + os.sep) or not os.path.isfile(full):
        raise FileNotFoundError(relative)
    return os.path.relpath(full, root).replace(os.sep, '/'), full


def signed_feed_url(camera_id):
    token = signing.dumps(camera_id, salt=FEED_SALT)
    return f'/api/camera/feed/{camera_id}/?t={token}'


def feed_token_is_valid(token, camera_id):
    try:
        return signing.loads(token or '', salt=FEED_SALT, max_age=FEED_MAX_AGE) == camera_id
    except signing.BadSignature:
        return False
