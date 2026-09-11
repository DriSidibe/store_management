import csv
import datetime
import io
import os

from django.db.models import ExpressionWrapper, F, FloatField, Sum
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image as ReportLabImage
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ActivityLog, Bill, BillItems, Customer, Product, Ravitaillement, Sell, Shelf,
    SupplieEntrance, Unity,
)
from .permissions import IsSuperUser
from .serializers import (
    ActivityLogSerializer, BillItemSerializer, BillSerializer, CustomerSerializer,
    ProductSerializer, RavitaillementSerializer, SellSerializer, ShelfSerializer,
    SupplieEntranceSerializer, UnitySerializer,
)
from .utils import generate_product_id, log_activity

SEARCH_RESULT_LIMIT = 5


class UnityViewSet(viewsets.ModelViewSet):
    queryset = Unity.objects.all()
    serializer_class = UnitySerializer


class ShelfViewSet(viewsets.ModelViewSet):
    queryset = Shelf.objects.all()
    serializer_class = ShelfSerializer


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    lookup_field = 'product_id'

    def get_queryset(self):
        qs = Product.objects.all().order_by('product_name')
        product_id = self.request.query_params.get('product_id')
        search = self.request.query_params.get('search')
        if product_id:
            qs = qs.filter(product_id=product_id.upper())
        elif search:
            qs = qs.filter(product_name__contains=search.title())
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
        instance.delete()

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """id -> name map, used to populate select dropdowns."""
        products = Product.objects.all().order_by('product_name')
        return Response({p.pk: p.product_name for p in products})

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        products = Product.objects.filter(
            product_quantity__lte=F('low_stock_threshold')
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


class SellViewSet(viewsets.ModelViewSet):
    queryset = Sell.objects.all().order_by('-sell_date')
    serializer_class = SellSerializer

    def perform_create(self, serializer):
        sale = serializer.save()
        name = sale.product.product_name if sale.product else sale.product_name
        log_activity(self.request, 'sold', 'Sell', f"{name} x{sale.quantity}", f"{sale.total_price} FCFA")

    def perform_destroy(self, instance):
        name = instance.product.product_name if instance.product else instance.product_name
        log_activity(self.request, 'deleted', 'Sell', f"{name} x{instance.quantity}")
        instance.delete()

    @action(detail=False, methods=['get'])
    def daily(self, request):
        """Sales for a single day, plus running profit totals - mirrors the
        legacy 'selled-products' screen."""
        date_str = request.query_params.get('date')
        if date_str:
            selected_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            selected_date = timezone.now().date()

        sales = Sell.objects.filter(sell_date__date=selected_date).order_by('pk')
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
        """Turns an ad-hoc sale (no linked product) into a real Product, and
        relinks every other sale sharing the same product_name to it."""
        sale = self.get_object()
        unity = Unity.objects.first()
        new_product = Product.objects.create(
            product_id=generate_product_id('A', '1'),
            product_name=sale.product_name,
            product_unity=unity,
            product_quantity=1,
            product_cp=1.0,
            product_sp=1.0,
            product_image=sale.product_image,
        )
        sale.product = new_product
        sale.save()

        for s in Sell.objects.exclude(pk=sale.pk).filter(product_name=sale.product_name):
            s.product_name = None
            s.product = new_product
            qty = float(s.quantity or 0)
            s.unit_price = float(s.total_price or 0) / qty if qty else 0
            s.save()

        log_activity(request, 'promoted', 'Sell', f"{new_product.product_id} ({new_product.product_name})")
        return Response(SellSerializer(sale).data, status=status.HTTP_201_CREATED)


class RavitaillementViewSet(viewsets.ModelViewSet):
    queryset = Ravitaillement.objects.all()
    serializer_class = RavitaillementSerializer

    def perform_create(self, serializer):
        rav = serializer.save()
        name = rav.product.product_name if rav.product else rav.product_name
        log_activity(self.request, 'created', 'Ravitaillement', name, f"quantité: {rav.commanded_quantity}")

    def perform_destroy(self, instance):
        name = instance.product.product_name if instance.product else instance.product_name
        log_activity(self.request, 'deleted', 'Ravitaillement', name)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='promote-to-product')
    def promote_to_product(self, request, pk=None):
        """Turns a pending supply request into a real Product and removes
        it from the approvisionnement list."""
        rav = self.get_object()
        unity = Unity.objects.first()
        product = Product.objects.create(
            product_id=generate_product_id('A', '1'),
            product_name=rav.product_name,
            product_unity=unity,
            product_quantity=1,
            product_cp=1.0,
            product_sp=1.0,
            product_image=rav.image,
        )
        rav.delete()
        log_activity(request, 'promoted', 'Ravitaillement', f"{product.product_id} ({product.product_name})")
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class SupplieEntranceViewSet(viewsets.ModelViewSet):
    queryset = SupplieEntrance.objects.all().order_by('-date')
    serializer_class = SupplieEntranceSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by('name')
    serializer_class = CustomerSerializer

    def perform_create(self, serializer):
        customer = serializer.save()
        log_activity(self.request, 'created', 'Customer', customer.name)

    def perform_destroy(self, instance):
        log_activity(self.request, 'deleted', 'Customer', instance.name)
        instance.delete()

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Purchase history for this customer, matched by name against the
        free-text customer_name fields on sales and bills."""
        customer = self.get_object()
        sales = Sell.objects.filter(customer_name=customer.name).order_by('-sell_date')
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

        sales = Sell.objects.all()

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
                Sell.objects.filter(sell_date__date__gte=start)
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
            Sell.objects.filter(product__isnull=False)
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

        products = (
            Product.objects.filter(product_name__icontains=query)
            | Product.objects.filter(product_id__icontains=query)
        ).distinct()
        sales = (
            Sell.objects.filter(product_name__icontains=query)
            | Sell.objects.filter(customer_name__icontains=query)
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

        headers, rows, image_col = self._build_rows(target)

        if request.query_params.get('export') == 'csv':
            return self._csv_response(target, headers, rows, image_col)
        return self._pdf_response(target, headers, rows, image_col)

    def _build_rows(self, target):
        if target == "commande":
            headers = ["Quantité commandée", "Produit", "Image", "Quantité", "Prix (FCFA)"]
            rows = []
            for r in Ravitaillement.objects.all():
                name = r.product_name if not r.product else r.product.product_name
                image_field = r.product.product_image if r.product else r.image
                rows.append([r.commanded_quantity, name, image_field, "...", "..........."])
            return headers, rows, 2
        elif target == "produits":
            headers = ["Produit", "Image", "Prix (FCFA)"]
            rows = [[p.product_name, p.product_image, "..........."] for p in Product.objects.all()]
            return headers, rows, 1
        else:  # vente
            headers = ["date", "Produit", "Client", "Quantité", "Prix Unitaire", "Prix Total"]
            rows = []
            for r in Sell.objects.all():
                name = r.product_name if not r.product else r.product.product_name
                rows.append([
                    str(r.sell_date).split(" ")[0], name, r.customer_name,
                    r.quantity, r.unit_price, r.total_price,
                ])
            return headers, rows, None

    def _pdf_response(self, target, headers, rows, image_col):
        style = TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ])
        data = [headers]
        for row in rows:
            row = list(row)
            if image_col is not None:
                row[image_col] = self._image_cell(row[image_col])
            data.append(row)
        table = Table(data)
        table.setStyle(style)
        buffer = io.BytesIO()
        SimpleDocTemplate(buffer, pagesize=A4).build([table])
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"{target}.pdf", content_type='application/pdf')

    def _csv_response(self, target, headers, rows, image_col):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{target}.csv"'
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
