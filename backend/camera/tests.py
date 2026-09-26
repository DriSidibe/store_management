import os
import shutil
import tempfile
from unittest import mock

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APITestCase


def fake_ffmpeg(command, **kwargs):
    """Stands in for ffmpeg: writes a recognisable file at the output path."""
    with open(command[-1], 'wb') as f:
        f.write(b'h264 version')


class MotionEyeVideoTests(APITestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.root)
        self.media = os.path.join(self.root, 'motioneye')
        self.cache = os.path.join(self.root, 'cache')
        day = os.path.join(self.media, 'Camera2', '2026-09-26')
        os.makedirs(day)
        for name in ('21-13-49.mp4', '21-13-49.mp4.thumb', '09-19-01.mp4', 'snap.jpg'):
            with open(os.path.join(day, name), 'wb') as f:
                f.write(b'mjpeg')
        settings = override_settings(MOTIONEYE_MEDIA_ROOT=self.media, VIDEO_CACHE_DIR=self.cache)
        settings.enable()
        self.addCleanup(settings.disable)
        self.admin = User.objects.create_superuser('admin', password='x')
        self.url = '/api/camera/motioneye/Camera2/2026-09-26/21-13-49.mp4/video/'

    def play(self, url=None):
        with mock.patch('camera.video.shutil.which', return_value='/usr/bin/ffmpeg'), \
                mock.patch('camera.video.subprocess.run', side_effect=fake_ffmpeg) as run:
            response = self.client.get(url or self.url)
        self.addCleanup(response.close)  # releases the served file (needed on Windows)
        return response, run

    def test_listing_gives_each_clip_its_thumbnail_in_time_order(self):
        self.client.force_authenticate(self.admin)

        data = self.client.get('/api/camera/motioneye/Camera2/2026-09-26/').data

        self.assertEqual(data['videos'], [
            {'name': '09-19-01.mp4', 'thumbnail': None},
            {'name': '21-13-49.mp4', 'thumbnail': '/media/motioneye/Camera2/2026-09-26/21-13-49.mp4.thumb'},
        ])
        self.assertEqual(data['images'], ['/media/motioneye/Camera2/2026-09-26/snap.jpg'])

    def test_clip_is_converted_once_then_served_from_cache(self):
        self.client.force_authenticate(self.admin)

        first, run = self.play()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first['Content-Type'], 'video/mp4')
        self.assertEqual(b''.join(first.streaming_content), b'h264 version')
        self.assertEqual(run.call_count, 1)
        self.assertIn('libx264', run.call_args.args[0])

        second, run = self.play()
        self.assertEqual(second.status_code, 200)
        self.assertEqual(run.call_count, 0)

    def test_newer_original_is_converted_again(self):
        self.client.force_authenticate(self.admin)
        self.play()[0].close()
        cached =os.path.join(self.cache, 'Camera2', '2026-09-26', '21-13-49.mp4')
        source = os.path.join(self.media, 'Camera2', '2026-09-26', '21-13-49.mp4')
        os.utime(source, (os.path.getmtime(cached) + 10,) * 2)

        _, run = self.play()

        self.assertEqual(run.call_count, 1)

    def test_only_admins_can_play(self):
        self.client.force_authenticate(User.objects.create_user('vendeur', password='x', is_staff=True))

        response, run = self.play()

        self.assertEqual(response.status_code, 403)
        self.assertEqual(run.call_count, 0)

    def test_unknown_or_escaping_paths_are_404(self):
        self.client.force_authenticate(self.admin)

        for url in (
            '/api/camera/motioneye/Camera2/2026-09-26/nope.mp4/video/',
            '/api/camera/motioneye/Camera2/2026-09-26/snap.jpg/video/',
            '/api/camera/motioneye/Camera2/..%2F..%2Fsecret/x.mp4/video/',
            '/api/camera/motioneye/Camera2/../2026-09-26/21-13-49.mp4/video/',
        ):
            response, run = self.play(url)
            self.assertEqual(response.status_code, 404, url)
            self.assertEqual(run.call_count, 0)
