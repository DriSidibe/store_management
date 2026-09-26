"""How long camera recordings are kept, and the nightly clean-up that
enforces it (see the purge_recordings command)."""
import datetime
import os
import shutil

from django.conf import settings
from django.utils import timezone

RETENTION_CHOICES = {
    7: '1 semaine',
    14: '2 semaines',
    30: '1 mois',
    60: '2 mois',
    90: '3 mois',
}
# Below this share of free disk space, the oldest days are deleted even if
# they are within the retention period, so recording never stops for lack
# of space.
MIN_FREE_RATIO = 0.10


def _day_folders(root):
    """(date, path) of every <camera>/<YYYY-MM-DD> folder under root, oldest first."""
    found = []
    if not os.path.isdir(root):
        return found
    for camera in os.scandir(root):
        if not camera.is_dir():
            continue
        for day in os.scandir(camera.path):
            if not day.is_dir():
                continue
            try:
                found.append((datetime.date.fromisoformat(day.name), day.path))
            except ValueError:
                continue
    return sorted(found)


def _folder_size(path):
    total = 0
    for dirpath, _, filenames in os.walk(path):
        for name in filenames:
            try:
                total += os.path.getsize(os.path.join(dirpath, name))
            except OSError:
                pass
    return total


def _disk(path):
    while not os.path.exists(path):
        path = os.path.dirname(path)
    return shutil.disk_usage(path)


def storage_summary():
    """Space used by recordings, and whether each retention choice fits on disk."""
    root = settings.MOTIONEYE_MEDIA_ROOT
    folders = _day_folders(root)
    used = sum(_folder_size(path) for _, path in folders)
    dates = sorted({day for day, _ in folders})
    per_day = used / len(dates) if dates else 0
    disk = _disk(root)
    # What recordings may occupy: what they use now plus the free space,
    # minus the safety margin kept free.
    budget = used + disk.free - disk.total * MIN_FREE_RATIO
    return {
        'used_bytes': used,
        'days_stored': len(dates),
        'oldest_day': dates[0].isoformat() if dates else None,
        'bytes_per_day': round(per_day),
        'disk_total_bytes': disk.total,
        'disk_free_bytes': disk.free,
        'choices': [
            {
                'days': days,
                'label': label,
                'estimated_bytes': round(per_day * days),
                'fits': per_day * days <= budget,
            }
            for days, label in RETENTION_CHOICES.items()
        ],
    }


def purge(retention_days, today=None, min_free_ratio=MIN_FREE_RATIO):
    """Deletes recordings older than `retention_days` (today counts as day 1),
    then the oldest remaining days while free space is below `min_free_ratio`
    (never today's). Browser-playable copies of deleted days go too.
    Returns [(date, path, bytes)] of what was removed."""
    today = today or timezone.localdate()
    root = settings.MOTIONEYE_MEDIA_ROOT
    last_day_to_delete = today - datetime.timedelta(days=retention_days)
    removed = []

    def remove(day, path):
        size = _folder_size(path)
        try:
            shutil.rmtree(path)
        except OSError:
            return False
        removed.append((day, path, size))
        return True

    remaining = []
    for day, path in _day_folders(root):
        if day <= last_day_to_delete:
            remove(day, path)
        else:
            remaining.append((day, path))

    def disk_is_short():
        disk = _disk(root)
        return disk.free < disk.total * min_free_ratio

    for day, path in remaining:
        if day >= today or not disk_is_short():
            break
        remove(day, path)

    removed_days = {day for day, _, _ in removed}
    for day, path in _day_folders(settings.VIDEO_CACHE_DIR):
        if day <= last_day_to_delete or day in removed_days:
            shutil.rmtree(path, ignore_errors=True)
    return removed
