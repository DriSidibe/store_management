from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('cameras', views.CameraViewSet, basename='camera')

urlpatterns = [
    path('', include(router.urls)),
    path('feed/<int:pk>/', views.video_feed, name='video_feed'),
    path('start-all/', views.start_all, name='start_all'),
    path('stop-all/', views.stop_all, name='stop_all'),
    path('save-snapshot/', views.save_snapshot, name='save_snapshot'),
    path('recordings/', views.LocalRecordingsView.as_view(), name='local_recordings'),
    path('motioneye/', views.MotionEyeCameraListView.as_view(), name='motioneye_cameras'),
    path('motioneye/<str:camera_id>/', views.MotionEyeDateListView.as_view(), name='motioneye_dates'),
    path('motioneye/<str:camera_id>/<str:date>/', views.MotionEyeMediaView.as_view(), name='motioneye_media'),
]
