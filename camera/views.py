from django.http import JsonResponse
from django.shortcuts import render
from .models import Camera
from django.core.serializers import serialize
import json

def camera_stream(request, pk):
    try:
        camera = Camera.objects.get(pk=pk)
        return JsonResponse({
            'id': camera.id,
            'name': camera.name,
            'description': camera.description,
            'ip_address': camera.ip_address,
            'resolution': camera.resolution,
            'is_active': camera.is_active,
            'quality': camera.quality,
            'brightness': camera.brightness,
            'contrast': camera.contrast,
            'vflip': camera.vflip,
            'hflip': camera.hflip,
            'stream_url': camera.stream_url,
        })
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Camera not found'}, status=404)
    
def camera_camera_status(request, pk):
    try:
        camera = Camera.objects.get(pk=pk)
        return JsonResponse({
            'online': camera.is_active,
        })
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Camera not found'}, status=404)

def cameras(request):
    cameras = Camera.objects.all()
    cameras_data = []
    
    for camera in cameras:
        cameras_data.append({
            'id': camera.id,
            'name': camera.name,
            'description': camera.description,
            'ip_address': camera.ip_address,
            'resolution': camera.resolution,
            'is_active': camera.is_active,
            'quality': camera.quality,
            'brightness': camera.brightness,
            'contrast': camera.contrast,
            'vflip': camera.vflip,
            'hflip': camera.hflip,
            'stream_url': camera.stream_url,
        })

    return JsonResponse({'cameras': cameras_data})

def camera_control_view(request):
    cameras = Camera.objects.all()
    return render(request, 'camera/camera_control.html', {'cameras': cameras})

def camera_control_flip(request, pk):
    if request.method == 'POST':
        data = json.loads(request.body)
        camera_id = pk
        type = data.get('type')
        isChecked = data.get('enabled')

        try:
            camera = Camera.objects.get(pk=camera_id)
            if type == 'vflip':
                camera.vflip = isChecked
            elif type == 'hflip':
                camera.hflip = isChecked
            camera.save()
            return JsonResponse({'status': 'success'})
        except Camera.DoesNotExist:
            return JsonResponse({'error': 'Camera not found'}, status=404)
        
def save_snapshot(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        camera_id = data.get('camera_id')
        snapshot = data.get('snapshot')

        try:
            camera = Camera.objects.get(pk=camera_id)
            # Here you would typically save the snapshot to a file or database
            # For demonstration, we will just return the snapshot data
            print(f"Snapshot for camera {camera.name}: {snapshot}")
            return JsonResponse({'status': 'success', 'snapshot': snapshot})
        except Camera.DoesNotExist:
            return JsonResponse({'error': 'Camera not found'}, status=404)
    return JsonResponse({'error': 'Invalid request method'}, status=400)