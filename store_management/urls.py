
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

#path('camera/', include('camera.urls')),

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('store.urls')),
    path('account/', include('accounts.urls')),
    path('camera/', include('camera.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
