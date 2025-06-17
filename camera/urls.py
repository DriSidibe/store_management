
from django.urls import path
from camera.views import video_feed, camera_page, save, start_all, stop_all
from camera.views_upgraded import camera_stream, camera_control_view, cameras, camera_camera_status, camera_control_flip, save_snapshot

urlpatterns = [
    path('<int:pk>/', camera_page, name='camera_stream'),
    path('feed/<int:pk>/', video_feed, name='video_feed'),
    path('save/<int:pk>/', save, name='save'),
    path('start_all/', start_all, name='start_all'),
    path('stop_all/', stop_all, name='stop_all'),
    path('control_panel/', camera_control_view, name='camera_control_view'),
    path('<int:pk>/stream/', camera_stream, name='camera-stream'),
    path('camera-status/<int:pk>/', camera_camera_status, name='camera-status'),
    path('<int:pk>/flip/', camera_control_flip, name='camera_control_flip'),
    path('save-snapshot/', save_snapshot, name='save_snapshot'),
    path('cameras/', cameras, name='cameras'),
]