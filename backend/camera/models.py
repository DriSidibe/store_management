from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Camera(models.Model):
    """Model representing a camera in the system."""
    
    RESOLUTION_CHOICES = [
        ('1600x1200', 'UXGA'),
        ('1280x1024', 'SXGA'),
        ('1280x720', 'HD'),
        ('1024x768', 'XGA'),
        ('800x600', 'SVGA'),
        ('640x480', 'VGA'),
        ('480x320', 'HVGA'),
        ('400x296', 'CIF'),
        ('320x240', 'QVGA'),
        ('240x240', '240x240'),
        ('240x176', 'HQVGA'),
        ('176x144', 'QCIF'),
        ('128x128', '128x128'),
        ('160x120', 'QQVGA'),
        ('96x96', '96x96'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField()
    resolution = models.CharField(
        max_length=10,
        choices=RESOLUTION_CHOICES,
        default='VGA',
        help_text="Select the camera resolution."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is the camera currently active?"
    )
    quality = models.IntegerField(
        default=10,
        help_text="Quality of the camera stream (4-63).",
        validators=[
            MinValueValidator(4),
            MaxValueValidator(63)
        ]
    )
    brightness = models.IntegerField(
        default=0,
        help_text="Brightness level of the camera (-2-2).",
        validators=[
            MinValueValidator(-2),
            MaxValueValidator(2)
        ]
    )
    contrast = models.IntegerField(
        default=0,
        help_text="Contrast level of the camera (-2-2).",
        validators=[
            MinValueValidator(-2),
            MaxValueValidator(2)
        ]
    )
    vflip = models.BooleanField(
        default=False,
        help_text="Vertical flip of the camera stream."
    )
    hflip = models.BooleanField(
        default=True,
        help_text="Horizontal flip of the camera stream."
    )

    @property
    def stream_url(self):
        """Generate the RTSP/HTTP stream URL based on camera IP"""
        return f"http://{self.ip_address}:81/stream"
    
    def get_absolute_url(self):
        """Alternative URL for camera-specific view"""
        return f"/camera/{self.id}/stream/"

    def __str__(self):
        return self.name