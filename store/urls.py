from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', views.index, name="index"),
    path('billing/', views.billing, name="billing"),
    path('add-product/', views.add_product, name="add-product"),
    path('delete-product/', views.delete_product, name="delete-product"),
    path('update-product/', views.update_product, name="update-product"),
    path('search-product/', views.search_product, name="search-product"),
    path('add-new-bill/', views.add_new_bill, name="add-new-bill"),
    path('existing-bills/', views.existing_bills, name="existing-bills"),
    path('add-product-to-bill/', views.add_product_to_bill, name="add-product-to-bill"),
    path('get-product/', views.get_product, name="get-product"),
    path('final-bill/<int:id>', views.final_bill, name="final-bill"),
    path('print-bill/<int:id>', views.print_bill, name="print-bill")
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)