import csv
import datetime
import io
import os

from django.db.models import Count, ExpressionWrapper, F, FloatField, Q, Sum
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image as ReportLabImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ActivityLog, Bill, BillItems, Category, Customer, Product, Ravitaillement, Sell, Shelf,
    SupplieEntrance, Unity,
)
from .permissions import IsStaffOrReadOnly, IsSuperUser
from .serializers import (
    ActivityLogSerializer, BillItemSerializer, BillSerializer, CategorySerializer,
    CustomerSerializer, ProductSerializer, PublicProductSerializer, RavitaillementSerializer,
    SellSerializer, ShelfSerializer, SupplieEntranceSerializer, UnitySerializer,
)
from .utils import generate_product_id, log_activity

SEARCH_RESULT_LIMIT = 5


class UnityViewSet(viewsets.ModelViewSet):
    queryset = Unity.objects.all()
    serializer_class = UnitySerializer


class ShelfViewSet(viewsets.ModelViewSet):
    queryset = Shelf.objects.all()
    serializer_class = ShelfSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    """Product categories, managed from their own page and picked from a list
    in the product forms. Not paginated: forms need the full list at once."""
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        return Category.objects.annotate(
            products_count=Count('products', filter=Q(products__is_deleted=False))
        ).order_by('name')

    def perform_create(self, serializer):
        category = serializer.save()
        log_activity(self.request, 'created', 'Category', category.name)

    def perform_update(self, serializer):
        old_name = serializer.instance.name
        category = serializer.save()
        details = f"ancien nom : {old_name}" if old_name != category.name else ""
        log_activity(self.request, 'updated', 'Category', category.name, details)

    def perform_destroy(self, instance):
        log_activity(self.request, 'deleted', 'Category', instance.name)
        instance.delete()


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    lookup_field = 'product_id'

    def get_queryset(self):
        qs = Product.objects.filter(is_deleted=False).order_by('product_name')
        product_id = self.request.query_params.get('product_id')
        search = self.request.query_params.get('search')
        if product_id:
            qs = qs.filter(product_id=product_id.upper())
        elif search:
            qs = qs.filter(
                Q(product_name__icontains=search)
                | Q(product_id__icontains=search)
                | Q(product_company__icontains=search)
            )
        return qs

    def get_object(self):
        kwarg = self.lookup_url_kwarg or self.lookup_field
        self.kwargs[kwarg] = self.kwargs[kwarg].upper()
        return super().get_object()

    def perform_create(self, serializer):
        product = serializer.save()
        log_activity(self.request, 'created', 'Product', f"{product.product_id} ({product.product_name})")

    def perform_update(self, serializer):
        product = serializer.save()
        log_activity(self.request, 'updated', 'Product', f"{product.product_id} ({product.product_name})")

    def perform_destroy(self, instance):
        log_activity(self.request, 'deleted', 'Product', f"{instance.product_id} ({instance.product_name})")
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted'])

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """id -> name map, used to populate select dropdowns."""
        products = Product.objects.filter(is_deleted=False).order_by('product_name')
        return Response({p.pk: p.product_name for p in products})

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        products = Product.objects.filter(
            is_deleted=False, product_quantity__lte=F('low_stock_threshold')
        ).order_by('product_quantity')
        page = self.paginate_queryset(products)
        serializer = self.get_serializer(page if page is not None else products, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        """Bulk create/update products from a CSV file. Rows with an existing
        product_id are updated in place; rows without one are created, and
        require product_id_etg/product_id_cas/product_name/product_unity."""
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded = io.TextIOWrapper(upload.file, encoding='utf-8-sig')
            reader = csv.DictReader(decoded)
        except Exception:
            return Response({'detail': 'Invalid CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

        created, updated, errors = 0, 0, []
        for i, raw_row in enumerate(reader, start=2):
            try:
                row = {k.strip(): (v or '').strip() for k, v in raw_row.items() if k}
                product_id = row.get('product_id', '').upper()

                unity = None
                if row.get('product_unity'):
                    unity, _ = Unity.objects.get_or_create(name=row['product_unity'])

                fields = {}
                if row.get('product_name'):
                    fields['product_name'] = row['product_name'].title()
                if row.get('product_description'):
                    fields['product_description'] = row['product_description']
                if unity:
                    fields['product_unity'] = unity
                if row.get('product_category'):
                    category, _ = Category.objects.get_or_create(name=row['product_category'])
                    fields['product_category'] = category
                if row.get('product_quantity'):
                    fields['product_quantity'] = int(row['product_quantity'])
                if row.get('product_company'):
                    fields['product_company'] = row['product_company']
                if row.get('product_cp'):
                    fields['product_cp'] = float(row['product_cp'])
                if row.get('product_sp'):
                    fields['product_sp'] = float(row['product_sp'])
                if row.get('low_stock_threshold'):
                    fields['low_stock_threshold'] = int(row['low_stock_threshold'])

                existing = Product.objects.filter(product_id=product_id) if product_id else None
                if existing and existing.exists():
                    existing.update(**fields)
                    updated += 1
                    continue

                etage, casier = row.get('product_id_etg'), row.get('product_id_cas')
                if not (etage and casier and fields.get('product_name') and unity):
                    errors.append({
                        'row': i,
                        'message': ("Champs requis manquants pour créer un produit "
                                    "(product_id_etg, product_id_cas, product_name, product_unity)."),
                    })
                    continue
                fields.setdefault('product_quantity', 0)
                fields.setdefault('product_cp', 0)
                fields.setdefault('product_sp', 0)
                Product.objects.create(product_id=generate_product_id(etage, casier), **fields)
                created += 1
            except Exception as e:
                errors.append({'row': i, 'message': str(e)})

        log_activity(
            request, 'imported', 'Product',
            f"{created} créés, {updated} mis à jour", f"{len(errors)} erreurs",
        )
        return Response({'created': created, 'updated': updated, 'errors': errors})


class PublicProductListView(generics.ListAPIView):
    """Public, unauthenticated storefront catalog - no login required."""
    serializer_class = PublicProductSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Product.objects.filter(is_deleted=False).order_by('product_name')
        search = self.request.query_params.get('search')
        company = self.request.query_params.get('company')
        category = self.request.query_params.get('category')
        if search:
            qs = qs.filter(Q(product_name__icontains=search) | Q(product_description__icontains=search))
        if company:
            qs = qs.filter(product_company=company)
        if category:
            qs = qs.filter(product_category__name=category)
        return qs


class PublicProductCompaniesView(APIView):
    """Distinct product companies/brands, for the storefront filter."""
    permission_classes = [AllowAny]

    def get(self, request):
        companies = (
            Product.objects.filter(is_deleted=False)
            .exclude(product_company='')
            .order_by('product_company')
            .values_list('product_company', flat=True)
            .distinct()
        )
        return Response(list(companies))


class PublicProductCategoriesView(APIView):
    """Categories actually used by non-deleted products, for the storefront
    category shortcuts."""
    permission_classes = [AllowAny]

    def get(self, request):
        categories = (
            Category.objects.filter(products__is_deleted=False)
            .order_by('name')
            .values_list('name', flat=True)
            .distinct()
        )
        return Response(list(categories))


class SellViewSet(viewsets.ModelViewSet):
    serializer_class = SellSerializer

    def get_queryset(self):
        return Sell.objects.filter(is_deleted=False).order_by('-sell_date')

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        sale = serializer.save(sold_by=user)
        name = sale.product.product_name if sale.product else sale.product_name
        log_activity(self.request, 'sold', 'Sell', f"{name} x{sale.quantity}", f"{sale.total_price} FCFA")

    def perform_update(self, serializer):
        had_product_id = serializer.instance.product_id
        sale = serializer.save()
        name = sale.product.product_name if sale.product else sale.product_name
        if 'product' in serializer.validated_data and sale.product_id != had_product_id:
            log_activity(self.request, 'updated', 'Sell', f"{name} x{sale.quantity}", "produit associé/changé")
        else:
            log_activity(self.request, 'updated', 'Sell', f"{name} x{sale.quantity}")

    def perform_destroy(self, instance):
        name = instance.product.product_name if instance.product else instance.product_name
        log_activity(self.request, 'deleted', 'Sell', f"{name} x{instance.quantity}")
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted'])

    @action(detail=False, methods=['get'])
    def daily(self, request):
        """Sales for a single day, plus running profit totals - mirrors the
        legacy 'selled-products' screen."""
        date_str = request.query_params.get('date')
        if date_str:
            selected_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            selected_date = timezone.now().date()

        sales = Sell.objects.filter(is_deleted=False, sell_date__date=selected_date).order_by('pk')
        total = sales.aggregate(Sum('total_price'))['total_price__sum'] or 0

        benefits = {}
        for _sale in sales:
            if not _sale.product:
                continue
            running_total = sum(
                (float(sale.unit_price) - sale.product.product_cp) * sale.quantity
                for sale in sales if sale.pk <= _sale.pk and sale.product
            )
            benefits[_sale.pk] = [
                float(_sale.total_price) - (float(_sale.quantity) * float(_sale.product.product_cp)),
                running_total,
            ]

        return Response({
            'sales': SellSerializer(sales, many=True).data,
            'selected_date': str(selected_date),
            'total': total,
            'benefits': benefits,
        })

    @action(detail=True, methods=['post'], url_path='promote-to-product')
    def promote_to_product(self, request, pk=None):
        """Turns an ad-hoc sale (no linked product) into a real Product using
        the details submitted in the promotion form, and relinks every other
        sale sharing the same product_name to it."""
        sale = self.get_object()

        data = request.data.copy()
        data.setdefault('product_name', sale.product_name)
        serializer = ProductSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        new_product = serializer.save()
        if not new_product.product_image and sale.product_image:
            new_product.product_image = sale.product_image
            new_product.save()

        sale.product = new_product
        sale.save()

        for s in Sell.objects.exclude(pk=sale.pk).filter(is_deleted=False, product_name=sale.product_name):
            s.product_name = None
            s.product = new_product
            qty = float(s.quantity or 0)
            s.unit_price = float(s.total_price or 0) / qty if qty else 0
            s.save()

        log_activity(request, 'promoted', 'Sell', f"{new_product.product_id} ({new_product.product_name})")
        return Response(SellSerializer(sale).data, status=status.HTTP_201_CREATED)


class RavitaillementViewSet(viewsets.ModelViewSet):
    serializer_class = RavitaillementSerializer

    def get_queryset(self):
        return Ravitaillement.objects.filter(is_deleted=False)

    def perform_create(self, serializer):
        rav = serializer.save()
        name = rav.product.product_name if rav.product else rav.product_name
        log_activity(self.request, 'created', 'Ravitaillement', name, f"quantité: {rav.commanded_quantity}")

    def perform_destroy(self, instance):
        name = instance.product.product_name if instance.product else instance.product_name
        log_activity(self.request, 'deleted', 'Ravitaillement', name)
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted'])

    @action(detail=True, methods=['post'], url_path='promote-to-product')
    def promote_to_product(self, request, pk=None):
        """Receives a pending supply request and removes it from the
        approvisionnement list. A request for a product already in the catalog
        is just closed; otherwise the product is created from the catalog form
        submitted with the request (same fields and checks as a new product)."""
        rav = self.get_object()
        if rav.product:
            rav.is_deleted = True
            rav.save(update_fields=['is_deleted'])
            log_activity(request, 'received', 'Ravitaillement', rav.product.product_name)
            return Response(RavitaillementSerializer(rav).data)

        data = request.data.copy()
        data.setdefault('product_name', rav.product_name)
        serializer = ProductSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        if not product.product_image and rav.image:
            product.product_image = rav.image
            product.save(update_fields=['product_image'])
        rav.is_deleted = True
        rav.save(update_fields=['is_deleted'])
        log_activity(request, 'promoted', 'Ravitaillement', f"{product.product_id} ({product.product_name})")
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class SupplieEntranceViewSet(viewsets.ModelViewSet):
    queryset = SupplieEntrance.objects.all().order_by('-date')
    serializer_class = SupplieEntranceSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return Customer.objects.filter(is_deleted=False).order_by('name')

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name')
        existing = Customer.objects.filter(name=name, is_deleted=True).first()
        if existing:
            for field, value in serializer.validated_data.items():
                setattr(existing, field, value)
            existing.is_deleted = False
            existing.save()
            serializer.instance = existing
            customer = existing
        else:
            customer = serializer.save()
        log_activity(self.request, 'created', 'Customer', customer.name)

    def perform_destroy(self, instance):
        log_activity(self.request, 'deleted', 'Customer', instance.name)
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted'])

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Purchase history for this customer, matched by name against the
        free-text customer_name fields on sales and bills."""
        customer = self.get_object()
        sales = Sell.objects.filter(is_deleted=False, customer_name=customer.name).order_by('-sell_date')
        bills = Bill.objects.filter(customer_name=customer.name).order_by('-date_created')
        total_spent = sum(float(s.total_price or 0) for s in sales)
        return Response({
            'customer': CustomerSerializer(customer).data,
            'sales': SellSerializer(sales, many=True).data,
            'bills': BillSerializer(bills, many=True).data,
            'total_spent': total_spent,
        })


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        qs = super().get_queryset()
        model_name = self.request.query_params.get('model_name')
        if model_name:
            qs = qs.filter(model_name=model_name)
        return qs


class BillViewSet(viewsets.ModelViewSet):
    queryset = Bill.objects.all().order_by('-id')
    serializer_class = BillSerializer

    def perform_create(self, serializer):
        bill = serializer.save()
        log_activity(self.request, 'created', 'Bill', bill.customer_name)

    @action(detail=True, methods=['get', 'post'], url_path='items')
    def items(self, request, pk=None):
        bill = self.get_object()
        if request.method == 'POST':
            product = get_object_or_404(Product, product_id=str(request.data.get('product_id', '')).upper())
            quantity = int(request.data.get('quantity'))
            if product.product_quantity < quantity:
                return Response(
                    {'detail': 'No sufficient products in the stock!'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            product.product_quantity -= quantity
            product.save()
            item = BillItems.objects.create(bill=bill, product=product, quantity=quantity)
            log_activity(
                request, 'billed', 'BillItems',
                f"{product.product_name} x{quantity} -> facture #{bill.id}",
            )
            return Response(BillItemSerializer(item).data, status=status.HTTP_201_CREATED)

        items = BillItems.objects.filter(bill=bill)
        return Response(BillItemSerializer(items, many=True).data)

    @action(detail=True, methods=['get'])
    def finalize(self, request, pk=None):
        bill = self.get_object()
        items = BillItems.objects.filter(bill=bill)
        grand_total = sum(
            int(i.quantity) * float(i.product.product_sp) for i in items if i.product
        )
        return Response({
            'bill': BillSerializer(bill).data,
            'items': BillItemSerializer(items, many=True).data,
            'grand_total': grand_total,
        })


class MetricsView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        now = timezone.now()
        today = now.date()
        start_week = today - datetime.timedelta(days=today.weekday())
        start_month = today.replace(day=1)
        start_year = today.replace(month=1, day=1)

        sales = Sell.objects.filter(is_deleted=False)

        benefit_expr = ExpressionWrapper(
            (F('product__product_sp') - F('product__product_cp')) * F('quantity'),
            output_field=FloatField()
        )

        kpis = {
            'total_sales': sales.aggregate(Sum('total_price'))['total_price__sum'] or 0,
            'daily_sales': sales.filter(sell_date__date=today).aggregate(Sum('total_price'))['total_price__sum'] or 0,
            'weekly_sales': sales.filter(sell_date__date__gte=start_week).aggregate(Sum('total_price'))['total_price__sum'] or 0,
            'monthly_sales': sales.filter(sell_date__date__gte=start_month).aggregate(Sum('total_price'))['total_price__sum'] or 0,
            'yearly_sales': sales.filter(sell_date__date__gte=start_year).aggregate(Sum('total_price'))['total_price__sum'] or 0,
            'total_transactions': sales.count(),
            'daily_profit': sales.filter(sell_date__date=today).aggregate(profit=Sum(benefit_expr))['profit'] or 0,
            'weekly_profit': sales.filter(sell_date__date__gte=start_week).aggregate(profit=Sum(benefit_expr))['profit'] or 0,
            'monthly_profit': sales.filter(sell_date__date__gte=start_month).aggregate(profit=Sum(benefit_expr))['profit'] or 0,
            'yearly_profit': sales.filter(sell_date__date__gte=start_year).aggregate(profit=Sum(benefit_expr))['profit'] or 0,
            'total_profit': sales.aggregate(profit=Sum(benefit_expr))['profit'] or 0,
        }

        return Response(kpis)


class SalesTrendView(APIView):
    """Daily sales totals for the last N days, for the dashboard line chart."""
    permission_classes = [IsSuperUser]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        today = timezone.now().date()
        start = today - datetime.timedelta(days=days - 1)
        sales_by_day = {
            row['day']: row['total'] or 0
            for row in (
                Sell.objects.filter(is_deleted=False, sell_date__date__gte=start)
                .values('sell_date__date')
                .annotate(day=F('sell_date__date'), total=Sum('total_price'))
                .values('day', 'total')
            )
        }
        trend = []
        for i in range(days):
            day = start + datetime.timedelta(days=i)
            trend.append({'date': str(day), 'total': sales_by_day.get(day, 0)})
        return Response(trend)


class TopProductsView(APIView):
    """Best-selling products by revenue, for the dashboard bar chart."""
    permission_classes = [IsSuperUser]

    def get(self, request):
        limit = int(request.query_params.get('limit', 5))
        top = (
            Sell.objects.filter(is_deleted=False, product__isnull=False)
            .values('product__product_name')
            .annotate(revenue=Sum('total_price'))
            .order_by('-revenue')[:limit]
        )
        return Response([
            {'product_name': row['product__product_name'], 'revenue': row['revenue'] or 0}
            for row in top
        ])


class GlobalSearchView(APIView):
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'products': [], 'sales': [], 'bills': []})

        products = Product.objects.filter(is_deleted=False).filter(
            Q(product_name__icontains=query) | Q(product_id__icontains=query)
        ).distinct()
        sales = Sell.objects.filter(is_deleted=False).filter(
            Q(product_name__icontains=query) | Q(customer_name__icontains=query)
        ).distinct()
        bills = Bill.objects.filter(customer_name__icontains=query)

        return Response({
            'products': ProductSerializer(products[:SEARCH_RESULT_LIMIT], many=True).data,
            'sales': SellSerializer(sales[:SEARCH_RESULT_LIMIT], many=True).data,
            'bills': BillSerializer(bills[:SEARCH_RESULT_LIMIT], many=True).data,
        })


REPORT_TARGETS = ('commande', 'produits', 'vente')


class ReportView(APIView):
    def get(self, request, target):
        if target not in REPORT_TARGETS:
            raise NotFound(f"Unknown report target: {target}")

        headers, rows, image_col = self._build_rows(target, request)

        if request.query_params.get('export') == 'csv':
            return self._csv_response(target, headers, rows, image_col)
        return self._pdf_response(target, headers, rows, image_col)

    def _build_rows(self, target, request):
        if target == "commande":
            headers = ["Produit", "Quantité commandée", "Image", "Stock actuel", "Prix vente (FCFA)"]
            rows = []
            for r in Ravitaillement.objects.filter(is_deleted=False):
                name = r.product_name if not r.product else r.product.product_name
                image_field = r.product.product_image if r.product else r.image
                stock = r.product.product_quantity if r.product else "-"
                price = r.product.product_sp if r.product else "-"
                rows.append([name, r.commanded_quantity, image_field, stock, price])
            return headers, rows, 2

        elif target == "produits":
            headers = [
                "Code", "Produit", "Catégorie", "Société", "Image",
                "Quantité", "Prix Achat", "Prix Vente", "Valeur Stock",
            ]
            qs = Product.objects.filter(is_deleted=False).order_by('product_name')
            if request.query_params.get('low_stock') == '1':
                qs = qs.filter(product_quantity__lte=F('low_stock_threshold'))
            rows = []
            total_value = 0
            for p in qs:
                value = p.product_quantity * p.product_sp
                total_value += value
                rows.append([
                    p.product_id, p.product_name,
                    p.product_category.name if p.product_category else "-",
                    p.product_company, p.product_image,
                    p.product_quantity, p.product_cp, p.product_sp, value,
                ])
            rows.append(["", "", "", "", "", "", "", "TOTAL :", total_value])
            return headers, rows, 4

        else:  # vente
            headers = ["Date", "Produit", "Client", "Quantité", "Prix Unitaire", "Prix Total", "Vendu par"]
            qs = Sell.objects.filter(is_deleted=False).order_by('sell_date')
            start = request.query_params.get('start')
            end = request.query_params.get('end')
            if start:
                qs = qs.filter(sell_date__date__gte=start)
            if end:
                qs = qs.filter(sell_date__date__lte=end)
            rows = []
            total_amount = 0
            for r in qs:
                name = r.product_name if not r.product else r.product.product_name
                total_amount += float(r.total_price or 0)
                rows.append([
                    str(r.sell_date).split(" ")[0], name, r.customer_name,
                    r.quantity, r.unit_price, r.total_price,
                    r.sold_by.username if r.sold_by else "-",
                ])
            rows.append(["", "", "", "", "TOTAL :", total_amount, ""])
            return headers, rows, None

    # Columns whose header implies long free text - given more relative
    # width and word-wrapped so long values don't overflow the page.
    _WIDE_HEADERS = {"produit", "nom", "client", "catégorie", "société", "vendu par"}

    def _column_widths(self, headers, available_width, image_col):
        weights = []
        for i, header in enumerate(headers):
            if i == image_col:
                weights.append(0.6)
            elif header.strip().lower() in self._WIDE_HEADERS:
                weights.append(2.2)
            else:
                weights.append(1.0)
        total = sum(weights)
        return [available_width * w / total for w in weights]

    def _pdf_response(self, target, headers, rows, image_col):
        cell_style = ParagraphStyle(
            'cell', parent=getSampleStyleSheet()['Normal'], fontSize=8, leading=10, alignment=TA_CENTER,
        )
        header_style = ParagraphStyle(
            'header', parent=cell_style, fontName='Helvetica-Bold', textColor=colors.white,
        )

        style = TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2a78d6")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("TOPPADDING", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.92)]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ])

        page_size = landscape(A4)
        margin = 24
        available_width = page_size[0] - 2 * margin
        col_widths = self._column_widths(headers, available_width, image_col)

        data = [[Paragraph(str(h), header_style) for h in headers]]
        for row in rows:
            row = list(row)
            for i, value in enumerate(row):
                if i == image_col:
                    row[i] = self._image_cell(value)
                else:
                    row[i] = Paragraph("" if value in (None, "") else str(value), cell_style)
            data.append(row)

        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(style)
        buffer = io.BytesIO()
        SimpleDocTemplate(
            buffer, pagesize=page_size,
            leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
        ).build([table])
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"{target}.pdf", content_type='application/pdf')

    def _csv_response(self, target, headers, rows, image_col):
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{target}.csv"'
        response.write('﻿')  # BOM so Excel detects UTF-8 and shows accents correctly
        writer = csv.writer(response)
        writer.writerow(headers)
        for row in rows:
            row = list(row)
            if image_col is not None:
                image_field = row[image_col]
                row[image_col] = image_field.url if image_field and image_field.name else ""
            writer.writerow(row)
        return response

    @staticmethod
    def _image_cell(image_field):
        if image_field and image_field.name and os.path.exists(image_field.path):
            return ReportLabImage(image_field.path, width=25, height=25)
        return ""
