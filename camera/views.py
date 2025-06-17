from django.http import JsonResponse
from django.shortcuts import redirect, render
from .models import Camera
import json
from django.http import StreamingHttpResponse
from .camera_stream import CameraStream, camera_stream_, reinitialize_camera_streams

def camera_page(request, pk):
    camera_count = 0
    with open('camera/cameras.json', 'r') as file:
        camera_count = len(json.load(file))
    return render(request, 'camera/stream.html', {'pk': pk, 'camera_count': camera_count})

def gen_frames(pk):
    while True:
        try:
            frame = [x for x in camera_stream_ if x.camera_id == pk][0].get_frame()
            if frame:
                yield (b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')
            else:
                yield b''
        except IndexError:
            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + b'\r\n\r\n'

def video_feed(request, pk):
    try:
        return StreamingHttpResponse(gen_frames(pk),
        content_type='multipart/x-mixed-replace; boundary=frame')
    except IndexError:
        return JsonResponse({'error': 'Camera not found'}, status=404)
    
def start_all(request):
    try:
        reinitialize_camera_streams()
        return JsonResponse(status=200)
    except Exception as e:
        return JsonResponse(status=500)

def stop_all(request):
    global camera_stream_
    try:
        for c in camera_stream_:
            c.stop()
            c.camera_id = -1
        camera_stream_ = [x for x in camera_stream_ if x.camera_id != -1]
        return JsonResponse(status=200)
    except Exception as e:
        return JsonResponse(status=500)
    
def save(request, pk):
    global camera_stream_
    try:
        cam = [x for x in camera_stream_ if x.camera_id == pk][0]
        ip = cam.url
        cam.stop()
        cam.camera_id = -1
        camera_stream_ = [x for x in camera_stream_ if x.camera_id != -1]
        camera_stream_.append(CameraStream(ip, pk))
        return redirect('camera_stream', pk=pk)
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Camera not found'}, status=404)