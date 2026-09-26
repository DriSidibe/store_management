import json
import os

from django.conf import settings
from django.http import FileResponse, JsonResponse, StreamingHttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .camera_stream import (
    RECORDINGS_DIR, CameraStream, camera_stream_, generate_thumbnail,
    reinitialize_camera_streams,
)
from store.permissions import IsSuperUser

from .models import Camera
from .serializers import CameraSerializer
from .video import VideoUnavailable, playable_clip


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all().order_by('id')
    serializer_class = CameraSerializer

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
    return StreamingHttpResponse(gen_frames(pk),
        content_type='multipart/x-mixed-replace; boundary=frame')


def start_all(request):
    try:
        reinitialize_camera_streams()
        return JsonResponse({}, status=200)
    except Exception:
        return JsonResponse({}, status=500)


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


def save_snapshot(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        camera_id = data.get('camera_id')
        snapshot = data.get('snapshot')
        try:
            camera = Camera.objects.get(pk=camera_id)
            print(f"Snapshot for camera {camera.name}: {snapshot}")
            return JsonResponse({'status': 'success', 'snapshot': snapshot})
        except Camera.DoesNotExist:
            return JsonResponse({'error': 'Camera not found'}, status=404)
    return JsonResponse({'error': 'Invalid request method'}, status=400)


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
                'url': f"{settings.MEDIA_URL}recordings/{f.name}",
                'thumbnail': f"{settings.MEDIA_URL}thumbnails/thumbnail_{stem}.jpg",
            })
        return Response(records)


class MotionEyeCameraListView(APIView):
    """Lists the camera folders motionEye has recorded to."""

    def get(self, request):
        base = settings.MOTIONEYE_MEDIA_ROOT
        if not os.path.isdir(base):
            return Response([])
        cameras = [d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))]
        return Response(cameras)


class MotionEyeDateListView(APIView):
    def get(self, request, camera_id):
        cam_path = os.path.join(settings.MOTIONEYE_MEDIA_ROOT, camera_id)
        if not os.path.isdir(cam_path):
            return Response({'error': 'Camera not found'}, status=404)
        dates = [d for d in os.listdir(cam_path) if os.path.isdir(os.path.join(cam_path, d))]
        dates.sort(reverse=True)
        return Response({'camera_id': camera_id, 'dates': dates})


class MotionEyeMediaView(APIView):
    def get(self, request, camera_id, date):
        folder = os.path.join(settings.MOTIONEYE_MEDIA_ROOT, camera_id, date)
        if not os.path.isdir(folder):
            return Response({'error': 'Not found'}, status=404)
        files = sorted(os.listdir(folder))
        base_url = f"{settings.MEDIA_URL}motioneye/{camera_id}/{date}/"
        images = [base_url + f for f in files if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))]
        # Videos are played through MotionEyeVideoView (converted to H.264);
        # motionEye's own .thumb files give a preview image for each clip.
        videos = [
            {'name': f, 'thumbnail': base_url + f + '.thumb' if f + '.thumb' in files else None}
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
