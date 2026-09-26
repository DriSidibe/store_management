from rest_framework import serializers

from .media_access import signed_feed_url
from .models import Camera


class CameraSerializer(serializers.ModelSerializer):
    feed_url = serializers.SerializerMethodField()

    class Meta:
        model = Camera
        fields = [
            'id', 'name', 'description', 'ip_address', 'resolution',
            'is_active', 'quality', 'brightness', 'contrast', 'vflip', 'hflip',
            'feed_url',
        ]

    def get_feed_url(self, obj):
        # Signed and expiring: the <img> showing the stream can't send the
        # auth header (see camera.media_access).
        return signed_feed_url(obj.id)
