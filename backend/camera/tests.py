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
        settings = override_settings(
            MEDIA_ROOT=self.root, MOTIONEYE_MEDIA_ROOT=self.media, VIDEO_CACHE_DIR=self.cache,
            PROTECTED_MEDIA_ACCEL=False,
        )
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

    def test_listing_gives_each_clip_a_signed_thumbnail_in_time_order(self):
        self.client.force_authenticate(self.admin)

        data = self.client.get('/api/camera/motioneye/Camera2/2026-09-26/').data

        self.assertEqual([v['name'] for v in data['videos']], ['09-19-01.mp4', '21-13-49.mp4'])
        self.assertIsNone(data['videos'][0]['thumbnail'])
        thumbnail = data['videos'][1]['thumbnail']
        self.assertTrue(thumbnail.startswith('/api/camera/media/?t='))
        self.client.force_authenticate(None)  # the signed link alone is enough
        response = self.client.get(thumbnail)
        self.assertEqual((response.status_code, response['Content-Type']), (200, 'image/jpeg'))
        self.assertEqual(b''.join(response.streaming_content), b'mjpeg')
        response.close()
        self.assertEqual(len(data['images']), 1)

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


class CameraAccessTests(APITestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.root)
        os.makedirs(os.path.join(self.root, 'motioneye', 'Camera1', '2026-09-26'))
        with open(os.path.join(self.root, 'motioneye', 'Camera1', '2026-09-26', 'a.jpg'), 'wb') as f:
            f.write(b'jpeg')
        with open(os.path.join(self.root, 'secret.txt'), 'wb') as f:
            f.write(b'secret')
        settings = override_settings(MEDIA_ROOT=self.root, PROTECTED_MEDIA_ACCEL=True)
        settings.enable()
        self.addCleanup(settings.disable)

    def test_signed_media_link_is_served_by_nginx_and_cannot_be_forged(self):
        from django.core import signing
        from camera.media_access import MEDIA_SALT, signed_media_url

        ok = self.client.get(signed_media_url('motioneye/Camera1/2026-09-26/a.jpg'))
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok['X-Accel-Redirect'], '/protected-media/motioneye/Camera1/2026-09-26/a.jpg')
        self.assertEqual(ok['Content-Type'], 'image/jpeg')

        forged = signing.dumps('secret.txt', salt='wrong-salt', compress=True)
        self.assertEqual(self.client.get(f'/api/camera/media/?t={forged}').status_code, 403)
        self.assertEqual(self.client.get('/api/camera/media/?t=garbage').status_code, 403)
        escaping = signing.dumps('../etc/passwd', salt=MEDIA_SALT, compress=True)
        self.assertEqual(self.client.get(f'/api/camera/media/?t={escaping}').status_code, 404)

    def test_signed_media_link_expires(self):
        from camera.media_access import signed_media_url

        url = signed_media_url('motioneye/Camera1/2026-09-26/a.jpg')
        with mock.patch('camera.media_access.MEDIA_MAX_AGE', -1):
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_live_feed_needs_the_signed_link_of_that_camera(self):
        from camera.media_access import signed_feed_url

        self.assertEqual(self.client.get('/api/camera/feed/1/').status_code, 403)
        other_camera = signed_feed_url(2).split('?')[1]
        self.assertEqual(self.client.get(f'/api/camera/feed/1/?{other_camera}').status_code, 403)
        with mock.patch('camera.views.gen_frames', return_value=iter([b'frame'])):
            response = self.client.get(signed_feed_url(1))
        self.assertEqual(response.status_code, 200)

    def test_camera_controls_need_a_login_and_admin_for_changes(self):
        self.assertEqual(self.client.post('/api/camera/start-all/').status_code, 401)
        self.assertEqual(self.client.post('/api/camera/stop-all/').status_code, 401)
        self.assertEqual(self.client.get('/api/camera/cameras/').status_code, 401)

        self.client.force_authenticate(User.objects.create_user('vendeur', password='x'))
        self.assertEqual(self.client.get('/api/camera/start-all/').status_code, 405)  # no GET side effects
        self.assertEqual(self.client.get('/api/camera/cameras/').status_code, 200)
        camera = {'name': 'Entrée', 'ip_address': '192.168.1.9'}
        self.assertEqual(self.client.post('/api/camera/cameras/', camera).status_code, 403)
        self.assertEqual(self.client.get('/api/camera/motioneye/').status_code, 403)

        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))
        self.assertEqual(self.client.post('/api/camera/cameras/', camera).status_code, 201)


class RetentionTests(APITestCase):
    def setUp(self):
        import datetime
        self.today = datetime.date(2026, 9, 26)
        self.root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.root)
        self.media = os.path.join(self.root, 'motioneye')
        self.cache = os.path.join(self.root, 'cache')
        for camera in ('Camera1', 'Camera2'):
            for days_ago in (0, 1, 29, 30, 45):
                day = (self.today - datetime.timedelta(days=days_ago)).isoformat()
                for base in (self.media, self.cache):
                    os.makedirs(os.path.join(base, camera, day))
                    with open(os.path.join(base, camera, day, 'clip.mp4'), 'wb') as f:
                        f.write(b'x' * 1000)
            with open(os.path.join(self.media, camera, 'lastsnap.jpg'), 'wb') as f:
                f.write(b'x')
        settings = override_settings(MOTIONEYE_MEDIA_ROOT=self.media, VIDEO_CACHE_DIR=self.cache)
        settings.enable()
        self.addCleanup(settings.disable)

    def days_left(self, base):
        days = set()
        for camera in os.listdir(base):
            folder = os.path.join(base, camera)
            if os.path.isdir(folder):
                days.update(d for d in os.listdir(folder) if d[0].isdigit())
        return sorted(days)

    def test_keeps_exactly_the_retention_period_and_cleans_the_cache(self):
        from camera.retention import purge

        removed = purge(30, today=self.today)

        self.assertEqual(self.days_left(self.media), ['2026-08-28', '2026-09-25', '2026-09-26'])
        self.assertEqual(self.days_left(self.cache), ['2026-08-28', '2026-09-25', '2026-09-26'])
        self.assertEqual(len(removed), 4)  # 2 cameras x (30 and 45 days ago)
        self.assertTrue(os.path.exists(os.path.join(self.media, 'Camera1', 'lastsnap.jpg')))

    def test_low_disk_space_deletes_oldest_days_but_never_today(self):
        from collections import namedtuple
        from camera.retention import purge
        Usage = namedtuple('Usage', 'total used free')

        with mock.patch('camera.retention.shutil.disk_usage', return_value=Usage(100, 99, 1)):
            purge(90, today=self.today)

        self.assertEqual(self.days_left(self.media), ['2026-09-26'])

    def test_settings_api_reports_usage_and_rejects_what_does_not_fit(self):
        from collections import namedtuple
        Usage = namedtuple('Usage', 'total used free')
        self.client.force_authenticate(User.objects.create_user('chef', password='x', is_staff=True))
        self.assertEqual(self.client.get('/api/camera/recording-settings/').status_code, 403)

        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))
        with mock.patch('camera.retention.shutil.disk_usage', return_value=Usage(100_000, 30_000, 70_000)):  # budget: 10k used + 70k free - 10k margin
            data = self.client.get('/api/camera/recording-settings/').data
            self.assertEqual(data['retention_days'], 30)
            self.assertEqual((data['days_stored'], data['oldest_day'], data['used_bytes']), (5, '2026-08-12', 10_000))
            fits = {c['days']: c['fits'] for c in data['choices']}
            self.assertEqual(fits, {7: True, 14: True, 30: True, 60: False, 90: False})

            self.assertEqual(self.client.put('/api/camera/recording-settings/', {'retention_days': 60}).status_code, 400)
            self.assertEqual(self.client.put('/api/camera/recording-settings/', {'retention_days': 10}).status_code, 400)
            response = self.client.put('/api/camera/recording-settings/', {'retention_days': 14})
        self.assertEqual((response.status_code, response.data['retention_days']), (200, 14))

    def test_nightly_command_uses_the_saved_setting(self):
        from django.core.management import call_command
        from camera.models import RecordingSettings
        RecordingSettings.objects.create(pk=1, retention_days=7)

        with mock.patch('camera.retention.timezone.localdate', return_value=self.today), \
                open(os.devnull, 'w') as devnull:
            call_command('purge_recordings', stdout=devnull)

        self.assertEqual(self.days_left(self.media), ['2026-09-25', '2026-09-26'])


class LiveCameraTests(APITestCase):
    CONFS = {
        'camera-1.conf': "# @enabled on\ncamera_name Bureau 1\nstream_port 8081\ntarget_dir /var/www/media/motioneye/Camera2\n",
        'camera-2.conf': "# @enabled on\ncamera_name Bureau 2\nstream_port 9082\ntarget_dir /var/www/media/motioneye/Camera1\n",
        'camera-3.conf': "# @enabled off\ncamera_name Garage\nstream_port 8083\ntarget_dir /var/www/media/motioneye/Camera3\n",
        'motion.conf': "stream_port 7999\n",
    }

    def setUp(self):
        self.conf = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.conf)
        for name, content in self.CONFS.items():
            with open(os.path.join(self.conf, name), 'w', encoding='utf-8') as f:
                f.write(content)
        settings = override_settings(MOTIONEYE_CONF_DIR=self.conf)
        settings.enable()
        self.addCleanup(settings.disable)

    def auth(self, uri):
        return self.client.get('/api/camera/live-auth/', HTTP_X_ORIGINAL_URI=uri).status_code

    def test_employees_get_the_motioneye_cameras_with_signed_links(self):
        self.assertEqual(self.client.get('/api/camera/live/').status_code, 401)
        self.client.force_authenticate(User.objects.create_user('vendeur', password='x'))

        cameras = self.client.get('/api/camera/live/').data

        self.assertEqual([(c['name'], c['folder'], c['enabled']) for c in cameras],
                         [('Bureau 1', 'Camera2', True), ('Bureau 2', 'Camera1', True), ('Garage', 'Camera3', False)])
        self.assertTrue(cameras[0]['stream_url'].startswith('/camera-live/8081/?t='))
        self.assertIsNone(cameras[2]['stream_url'])

    def test_nginx_relays_only_valid_links_to_declared_stream_ports(self):
        from django.core import signing
        from camera.live import LIVE_SALT, signed_live_url

        self.assertEqual(self.auth(signed_live_url(8081)), 204)
        self.assertEqual(self.auth(signed_live_url(9082)), 204)
        self.assertEqual(self.auth('/camera-live/8081/'), 403)
        self.assertEqual(self.auth('/camera-live/8081/?t=forged'), 403)
        other = signed_live_url(9082).split('?')[1]
        self.assertEqual(self.auth(f'/camera-live/8081/?{other}'), 403)  # link of another camera
        self.assertEqual(self.auth(signed_live_url(8765)), 403)  # motionEye admin UI, not a stream
        self.assertEqual(self.auth(signed_live_url(7999)), 403)
        self.assertEqual(self.auth(signed_live_url(8083)), 403)  # disabled camera
        self.assertEqual(self.auth(''), 403)
        with mock.patch('camera.live.LIVE_MAX_AGE', -1):
            self.assertEqual(self.auth(signed_live_url(8081)), 403)  # expired
        wrong_salt = signing.dumps(8081, salt='camera-feed')
        self.assertEqual(self.auth(f'/camera-live/8081/?t={wrong_salt}'), 403)
        self.assertNotEqual(LIVE_SALT, 'camera-feed')

    def test_admin_can_turn_a_camera_live_view_off_and_on(self):
        from camera.live import signed_live_url
        link_before = signed_live_url(8081)
        self.client.force_authenticate(User.objects.create_user('chef', password='x', is_staff=True))
        self.assertEqual(self.client.patch('/api/camera/live/1/', {'live_enabled': False}, format='json').status_code, 403)

        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))
        self.assertEqual(self.client.patch('/api/camera/live/9/', {'live_enabled': False}, format='json').status_code, 404)
        self.assertEqual(self.client.patch('/api/camera/live/1/', {'live_enabled': 'non'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/camera/live/1/', {'live_enabled': False}, format='json').status_code, 200)

        bureau1 = self.client.get('/api/camera/live/').data[0]
        self.assertEqual((bureau1['live_enabled'], bureau1['stream_url']), (False, None))
        self.assertEqual(self.auth(link_before), 403)  # links handed out earlier stop working too
        self.assertEqual(self.auth(signed_live_url(9082)), 204)  # the other camera is untouched

        self.client.patch('/api/camera/live/1/', {'live_enabled': True}, format='json')
        self.assertTrue(self.client.get('/api/camera/live/').data[0]['stream_url'])
        self.assertEqual(self.auth(link_before), 204)
