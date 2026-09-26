import mimetypes
import os
from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.http import FileResponse, HttpResponse, HttpResponseForbidden, JsonResponse, StreamingHttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .camera_stream import (
    RECORDINGS_DIR, CameraStream, camera_stream_, generate_thumbnail,
    reinitialize_camera_streams,
)
from store.permissions import IsSuperUser
from store.utils import log_activity

from .live import live_request_allowed, motioneye_cameras, signed_live_url
from .media_access import feed_token_is_valid, resolve_media_token, signed_media_url
from .models import Camera, RecordingSettings
from .retention import RETENTION_CHOICES, storage_summary
from .serializers import CameraSerializer
from .video import VideoUnavailable, playable_clip


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all().order_by('id')
    serializer_class = CameraSerializer

    def get_permissions(self):
        # Adding, editing or removing cameras is for admins; watching them
        # (and flipping/saving the stream, offered on the live page) for all.
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsSuperUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'], url_path='status')
    def status_(self, request, pk=None):
        camera = self.get_object()
        return Response({'online': camera.is_active})

    @action(detail=True, methods=['post'], url_path='flip')
    def flip(self, request, pk=None):
        camera = self.get_object()
        flip_type = request.data.get('type')
        enabled = request.data.get('enabled')
        if flip_type not in ('vflip', 'hflip'):
            return Response({'error': "type must be 'vflip' or 'hflip'"}, status=status.HTTP_400_BAD_REQUEST)
        setattr(camera, flip_type, bool(enabled))
        camera.save()
        return Response(CameraSerializer(camera, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='save')
    def save_stream(self, request, pk=None):
        global camera_stream_
        camera_id = int(pk)
        try:
            cam = next(x for x in camera_stream_ if x.camera_id == camera_id)
        except StopIteration:
            return JsonResponse({'error': 'Camera stream not running'}, status=404)
        ip = cam.url
        cam.stop()
        generate_thumbnail(cam.file_name)
        cam.camera_id = -1
        camera_stream_ = [x for x in camera_stream_ if x.camera_id != -1]
        camera_stream_.append(CameraStream(ip, camera_id))
        return Response({'status': 'ok'})


def gen_frames(pk):
    while True:
        try:
            frame = next(x for x in camera_stream_ if x.camera_id == pk).get_frame()
            if frame:
                yield (b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
            else:
                yield b''
        except StopIteration:
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + b'\r\n\r\n'


def video_feed(request, pk):
    if not feed_token_is_valid(request.GET.get('t'), pk):
        return HttpResponseForbidden("Lien de la caméra invalide ou expiré.")
    return StreamingHttpResponse(gen_frames(pk),
        content_type='multipart/x-mixed-replace; boundary=frame')


@api_view(['POST'])
def start_all(request):
    try:
        reinitialize_camera_streams()
        return JsonResponse({}, status=200)
    except Exception:
        return JsonResponse({}, status=500)


@api_view(['POST'])
def stop_all(request):
    global camera_stream_
    try:
        for c in camera_stream_:
            c.stop()
            generate_thumbnail(c.file_name)
            c.camera_id = -1
        camera_stream_ = [x for x in camera_stream_ if x.camera_id != -1]
        return JsonResponse({}, status=200)
    except Exception:
        return JsonResponse({}, status=500)


@api_view(['POST'])
def save_snapshot(request):
    camera_id = request.data.get('camera_id')
    snapshot = request.data.get('snapshot')
    try:
        camera = Camera.objects.get(pk=camera_id)
        print(f"Snapshot for camera {camera.name}: {snapshot}")
        return JsonResponse({'status': 'success', 'snapshot': snapshot})
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Camera not found'}, status=404)


class LocalRecordingsView(APIView):
    """Locally recorded clips (this server's own CameraStream recordings),
    each with a generated thumbnail - used by the live-camera viewer."""

    def get(self, request):
        if not os.path.isdir(RECORDINGS_DIR):
            return Response([])
        records = []
        for f in sorted(os.scandir(RECORDINGS_DIR), key=lambda e: e.stat().st_mtime, reverse=True):
            if not f.is_file():
                continue
            stem = f.name.split('.')[0]
            records.append({
                'name': f.name,
                'url': signed_media_url(f"recordings/{f.name}"),
                'thumbnail': signed_media_url(f"thumbnails/thumbnail_{stem}.jpg"),
            })
        return Response(records)


class MotionEyeCameraListView(APIView):
    """Lists the camera folders motionEye has recorded to."""
    permission_classes = [IsSuperUser]

    def get(self, request):
        base = settings.MOTIONEYE_MEDIA_ROOT
        if not os.path.isdir(base):
            return Response([])
        cameras = [d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))]
        return Response(cameras)


class MotionEyeDateListView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request, camera_id):
        cam_path = os.path.join(settings.MOTIONEYE_MEDIA_ROOT, camera_id)
        if not os.path.isdir(cam_path):
            return Response({'error': 'Camera not found'}, status=404)
        dates = [d for d in os.listdir(cam_path) if os.path.isdir(os.path.join(cam_path, d))]
        dates.sort(reverse=True)
        return Response({'camera_id': camera_id, 'dates': dates})


class MotionEyeMediaView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request, camera_id, date):
        folder = os.path.join(settings.MOTIONEYE_MEDIA_ROOT, camera_id, date)
        if not os.path.isdir(folder):
            return Response({'error': 'Not found'}, status=404)
        files = sorted(os.listdir(folder))
        media_dir = os.path.relpath(folder, settings.MEDIA_ROOT).replace(os.sep, '/')
        images = [
            signed_media_url(f"{media_dir}/{f}")
            for f in files if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))
        ]
        # Videos are played through MotionEyeVideoView (converted to H.264);
        # motionEye's own .thumb files give a preview image for each clip.
        videos = [
            {'name': f, 'thumbnail': signed_media_url(f"{media_dir}/{f}.thumb") if f + '.thumb' in files else None}
            for f in files if f.lower().endswith('.mp4')
        ]
        return Response({'camera_id': camera_id, 'date': date, 'images': images, 'videos': videos})


class MotionEyeVideoView(APIView):
    """One motionEye clip in a browser-playable form (see camera.video)."""
    permission_classes = [IsSuperUser]

    def get(self, request, camera_id, date, filename):
        try:
            path = playable_clip(camera_id, date, filename)
        except FileNotFoundError:
            return Response({'detail': "Vidéo introuvable."}, status=status.HTTP_404_NOT_FOUND)
        except VideoUnavailable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return FileResponse(open(path, 'rb'), content_type='video/mp4')


class ProtectedMediaView(APIView):
    """Serves a camera file from a signed link (see camera.media_access).
    In production nginx sends the file itself (X-Accel-Redirect to an
    internal location); elsewhere Django streams it."""
    permission_classes = [AllowAny]  # the signed token is the credential
    authentication_classes = []

    def get(self, request):
        try:
            relative, full = resolve_media_token(request.query_params.get('t'))
        except signing.BadSignature:
            return HttpResponseForbidden("Lien invalide ou expiré.")
        except FileNotFoundError:
            return Response({'detail': "Fichier introuvable."}, status=status.HTTP_404_NOT_FOUND)
        content_type = 'image/jpeg' if relative.endswith('.thumb') else (
            mimetypes.guess_type(relative)[0] or 'application/octet-stream'
        )
        if settings.PROTECTED_MEDIA_ACCEL:
            response = HttpResponse(content_type=content_type)
            response['X-Accel-Redirect'] = '/protected-media/' + quote(relative)
        else:
            response = FileResponse(open(full, 'rb'), content_type=content_type)
        response['Cache-Control'] = 'private, max-age=3600'
        return response


class RecordingSettingsView(APIView):
    """How long recordings are kept (enforced nightly by purge_recordings),
    with the disk usage needed to choose sensibly."""
    permission_classes = [IsSuperUser]

    def get(self, request):
        return Response({'retention_days': RecordingSettings.load().retention_days, **storage_summary()})

    def put(self, request):
        try:
            days = int(request.data.get('retention_days'))
        except (TypeError, ValueError):
            days = None
        if days not in RETENTION_CHOICES:
            return Response({'retention_days': "Durée non proposée."}, status=status.HTTP_400_BAD_REQUEST)
        choice = next(c for c in storage_summary()['choices'] if c['days'] == days)
        if not choice['fits']:
            return Response(
                {'retention_days': "Pas assez d'espace disque pour garder les vidéos aussi longtemps."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        settings_row = RecordingSettings.load()
        previous = settings_row.retention_days
        settings_row.retention_days = days
        settings_row.save(update_fields=['retention_days'])
        log_activity(request, 'updated', 'RecordingSettings', f"Conservation des vidéos : {RETENTION_CHOICES[days]}",
                     f"avant : {previous} jours")
        return self.get(request)


class LiveCamerasView(APIView):
    """The motionEye cameras, each with a signed link to its live stream."""

    def get(self, request):
        return Response([
            {
                'id': c['id'], 'name': c['name'], 'folder': c['folder'], 'enabled': c['enabled'],
                'stream_url': signed_live_url(c['port']) if c['enabled'] else None,
            }
            for c in motioneye_cameras()
        ])


class LiveAuthView(APIView):
    """Called by nginx (auth_request) before relaying a live stream: the
    original URI comes in the X-Original-URI header."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        allowed = live_request_allowed(request.META.get('HTTP_X_ORIGINAL_URI'))
        return HttpResponse(status=204 if allowed else 403)
