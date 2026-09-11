from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('units', views.UnityViewSet, basename='unity')
router.register('shelves', views.ShelfViewSet, basename='shelf')
router.register('products', views.ProductViewSet, basename='product')
router.register('sales', views.SellViewSet, basename='sale')
router.register('ravitaillement', views.RavitaillementViewSet, basename='ravitaillement')
router.register('supplier-entrances', views.SupplieEntranceViewSet, basename='supplier-entrance')
router.register('bills', views.BillViewSet, basename='bill')
router.register('customers', views.CustomerViewSet, basename='customer')
router.register('activity-log', views.ActivityLogViewSet, basename='activity-log')

urlpatterns = [
    path('', include(router.urls)),
    path('metrics/', views.MetricsView.as_view(), name='metrics'),
    path('metrics/trend/', views.SalesTrendView.as_view(), name='sales-trend'),
    path('metrics/top-products/', views.TopProductsView.as_view(), name='top-products'),
    path('search/', views.GlobalSearchView.as_view(), name='search'),
    path('reports/<str:target>/', views.ReportView.as_view(), name='report'),
]
