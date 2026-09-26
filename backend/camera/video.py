import os
import re
import shutil
import subprocess
import tempfile

from django.conf import settings

# Folder and file names motionEye produces: "Camera1", "2026-09-26", "21-13-49.mp4".
SAFE_NAME = re.compile(r'^[\w][\w.-]*$')


class VideoUnavailable(Exception):
    """The clip exists but can't be turned into a playable video."""


def playable_clip(camera_id, date, filename):
    """Returns the path of a browser-playable (H.264) copy of a motionEye clip.

    motionEye stores the cameras' MJPEG stream as-is inside .mp4 files, which
    no browser can play. The first request converts the clip with ffmpeg
    (under a second for a typical clip) and caches the result outside the
    public media folder; later requests reuse it. The original is untouched.
    """
    for part in (camera_id, date, filename):
        if not SAFE_NAME.match(part) or '..' in part:
            raise FileNotFoundError(part)
    source = os.path.join(settings.MOTIONEYE_MEDIA_ROOT, camera_id, date, filename)
    if not filename.lower().endswith('.mp4') or not os.path.isfile(source):
        raise FileNotFoundError(source)

    target = os.path.join(settings.VIDEO_CACHE_DIR, camera_id, date, filename)
    if os.path.isfile(target) and os.path.getmtime(target) >= os.path.getmtime(source):
        return target

    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise VideoUnavailable("ffmpeg n'est pas installé sur le serveur.")
    os.makedirs(os.path.dirname(target), exist_ok=True)

    # Unique temp file in the same folder, renamed atomically once complete,
    # so two viewers opening the same clip never read a half-written file.
    fd, partial = tempfile.mkstemp(suffix='.mp4', dir=os.path.dirname(target))
    os.close(fd)
    command = [
        ffmpeg, '-v', 'error', '-y', '-i', source,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',  # H.264/yuv420p needs even dimensions
        '-movflags', '+faststart', '-an', partial,
    ]
    nice = shutil.which('nice')
    if nice:
        command = [nice, '-n', '10', *command]  # never slow down the live recording
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        os.remove(partial)
        raise VideoUnavailable("Impossible de convertir cette vidéo.") from exc
    os.replace(partial, target)
    return target
