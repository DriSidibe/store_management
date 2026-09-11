import io
import random

from django.core.files.base import ContentFile
from PIL import Image


def convert_to_jpeg(uploaded_file):
    try:
        with Image.open(uploaded_file) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG")
            buffer.seek(0)
            return buffer
    except Exception:
        return None


def compress_image(uploaded_file, quality=10):
    with Image.open(uploaded_file) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality)
        buffer.seek(0)
        return buffer


def resize_image(image, size=(300, 300)):
    buffer = io.BytesIO()
    Image.open(image).resize(size).save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


def process_product_image(uploaded_file):
    """Runs an uploaded image through the same convert/compress/resize
    pipeline the legacy views used, and returns a Django ContentFile ready
    to be assigned to an ImageField."""
    buffer = resize_image(compress_image(convert_to_jpeg(uploaded_file)))
    return ContentFile(buffer.read(), name=uploaded_file.name)


def generate_product_id(etage, casier):
    seq = f'{random.randint(1, 99999):05d}'
    return build_product_id(etage, casier, seq)


def build_product_id(etage, casier, seq):
    return f"AM-{etage}-{casier}-{seq}"


def log_activity(request, action, model_name, object_repr, details=""):
    """Records one row in the activity log. Best-effort: a logging failure
    must never break the actual operation it's recording."""
    from .models import ActivityLog

    try:
        user = request.user if request.user.is_authenticated else None
        ActivityLog.objects.create(
            user=user, action=action, model_name=model_name,
            object_repr=str(object_repr)[:255], details=str(details)[:255],
        )
    except Exception:
        pass
