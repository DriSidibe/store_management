"""Live view of the motionEye cameras.

motionEye streams each camera (MJPEG) on a local port. nginx relays
/camera-live/<port>/ to it, but first asks the app (auth_request) whether
the link is valid: links are signed per port and expire, and only the
stream ports declared in motionEye's camera configs are allowed, so the
relay can't reach any other local service."""
import glob
import os
import re
from urllib.parse import parse_qs, urlsplit

from django.conf import settings
from django.core import signing

from .models import LiveStreamSetting

LIVE_SALT = 'camera-live'
LIVE_MAX_AGE = 12 * 3600
LIVE_PATH = re.compile(r'^/camera-live/(\d+)/$')


def motioneye_cameras():
    """Cameras declared in motionEye's camera-<n>.conf files, in order."""
    cameras = []
    for path in glob.glob(os.path.join(settings.MOTIONEYE_CONF_DIR, 'camera-*.conf')):
        number = re.search(r'camera-(\d+)\.conf$', path)
        if not number:
            continue
        values, enabled = {}, True
        with open(path, encoding='utf-8', errors='replace') as f:
            for line in f:
                line = line.strip()
                if line.startswith('# @enabled'):
                    enabled = line.split()[-1] == 'on'
                elif line and not line.startswith(('#', ';')):
                    key, _, value = line.partition(' ')
                    values[key] = value.strip()
        try:
            port = int(values.get('stream_port', ''))
        except ValueError:
            continue
        cameras.append({
            'id': int(number.group(1)),
            'name': values.get('camera_name') or f'Caméra {number.group(1)}',
            'port': port,
            # Folder its recordings go to: lets the live view share the
            # rotation chosen for that camera's recordings.
            'folder': os.path.basename(values.get('target_dir', '').rstrip('/')),
            'enabled': enabled,
        })
    return sorted(cameras, key=lambda c: c['id'])


def live_disabled_ids():
    """motionEye camera ids whose live view an admin turned off."""
    return set(LiveStreamSetting.objects.filter(enabled=False).values_list('motion_camera_id', flat=True))


def signed_live_url(port):
    return f'/camera-live/{port}/?t={signing.dumps(port, salt=LIVE_SALT)}'


def live_request_allowed(original_uri):
    """Whether nginx may relay this /camera-live/<port>/?t=... request."""
    parts = urlsplit(original_uri or '')
    match = LIVE_PATH.match(parts.path)
    if not match:
        return False
    port = int(match.group(1))
    token = parse_qs(parts.query).get('t', [''])[0]
    try:
        if signing.loads(token, salt=LIVE_SALT, max_age=LIVE_MAX_AGE) != port:
            return False
    except signing.BadSignature:
        return False
    disabled = live_disabled_ids()
    return port in {c['port'] for c in motioneye_cameras() if c['enabled'] and c['id'] not in disabled}
