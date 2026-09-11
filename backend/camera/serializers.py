from rest_framework import serializers

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
        request = self.context.get('request')
        path = f'/api/camera/feed/{obj.id}/'
        return request.build_absolute_uri(path) if request else path
