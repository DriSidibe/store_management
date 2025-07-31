import json
import os
from django.shortcuts import render, redirect
from .models import *
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.paginator import Paginator
from PIL import Image
import io
import random
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core import serializers
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import user_passes_test
from django.utils import timezone
from django.db.models import Sum
import datetime
from django.db.models import Sum, F, ExpressionWrapper, FloatField
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer
from reportlab.platypus import Image as reportlab_image
from reportlab.lib import colors

def convert_to_jpeg(uploaded_file):
    try:
        # Ouvrir l'image à partir du fichier téléchargé
        with Image.open(uploaded_file) as img:
            # Convertir en mode RGB si nécessaire (certains formats comme PNG peuvent avoir un canal alpha)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Créer un buffer pour l'image convertie
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG")
            buffer.seek(0)
            return buffer
    except Exception as e:
        return None


def compress_image(uploaded_file, quality=10):
    try:
        # Ouvrir l'image à partir du fichier téléchargé
        with Image.open(uploaded_file) as img:
            # Convertir en mode RGB si nécessaire (certains formats comme PNG peuvent avoir un canal alpha)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Créer un buffer pour l'image compressée
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=quality)
            buffer.seek(0)
            return buffer
    except Exception as e:
        raise None

def resize_image(image, size=(300, 300)):
    try:
        # Redimensionner proportionnellement pour tenir dans 300x300
        buffer = io.BytesIO()
        Image.open(image).resize(size).save(buffer, format="JPEG")
        buffer.seek(0)
        return buffer
    except Exception as e:
        raise e


@csrf_exempt
@login_required(login_url="/account/login")
def index(request):
    page_size = 20
    if request.method == 'POST' and 'page_number' not in request.POST:
        if 'product_id' in request.POST and request.POST['product_id'] != '':
            productList = Product.objects.filter(product_id=request.POST['product_id'].upper())
        else:
            productList = Product.objects.filter(product_name__contains=request.POST['prod_name'].title()).order_by('product_name')
        if 'suggestion' in request.POST:
            if request.POST["suggestion"] != "_":
                products = json.loads(serializers.serialize('json', productList))
                productList_ = [p["fields"] for p in products]
                return JsonResponse(productList_, safe=False)
            productList = [productList[0]]
    else:
        productList = Product.objects.order_by('product_name')
    context = {'products':Paginator(productList, page_size).get_page(int(request.POST['page_number'][0])) if 'page_number' in request.POST else Paginator(productList, page_size).get_page(1)}
    return render(request, 'dashboard.html', context)


@login_required(login_url="/account/login")
@user_passes_test(lambda u: u.is_superuser)
def metrics(request):
    now = timezone.now()
    today = now.date()
    start_week = today - datetime.timedelta(days=today.weekday())
    start_month = today.replace(day=1)
    start_year = today.replace(month=1, day=1)

    sales = Sell.objects.all()
    products = Product.objects.all()

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

    context = {'kpi_items': [
            ('daily_sales', "Aujourd'hui", "success"),
            ('weekly_sales', "Cette semaine", "info"),
            ('monthly_sales', "Ce mois-ci", "warning"),
            ('yearly_sales', "Cette année", "primary"),
            ('total_sales', "Total des ventes", "dark"),
            ('total_transactions', "Nombre de ventes", "secondary")
        ],
        'profit_kpis':[
            ('daily_profit', "Aujourd'hui", "success"),
            ('weekly_profit', "Cette semaine", "info"),
            ('monthly_profit', "Ce mois-ci", "warning"),
            ('yearly_profit', "Cette année", "primary"),
            ('total_profit', "Total", "dark")
        ],
        'kpis': kpis,
        'products': products
    }

    return render(request, 'metrics.html', context)

@require_http_methods(["GET"])
@login_required(login_url="/account/login")
def sell_product(request):
    if "view" in request.GET:
        return render(request, 'sell-product.html')
    quantity = request.GET.get("quantity")
    price = request.GET.get("price")
    customer = request.GET.get("customer", None)

    product = None
    if "productId" in request.GET:
        product = Product.objects.get(product_id=request.GET.get("productId"))
    product_name = ""
    if "product_name" in request.GET:
        product_name = request.GET.get("product_name")
        
    sell = Sell(product=product, quantity=quantity, total_price=price, unit_price=int(price)/float(quantity), product_name=product_name, customer_name=customer)
    sell.save()
    messages.success(request, "Produit vendu avec success!")
    return redirect('selled-products')

@login_required(login_url="/account/login")
def update_sale(request):
    if "delete" in request.GET:
        pk = int(request.GET.get("pk", None))
        sale = Sell.objects.get(pk=pk)
        sale.delete()
        return redirect("selled-products")
    if "create" in request.GET:
        pk = int(request.GET.get("pk", None))
        sale = Sell.objects.get(pk=pk)
        product_id = "AM"+"-A"+"-1"+"-"+f'{random.randint(1, 99999):05d}'
        new_product = Product(product_id=product_id, product_name=sale.product_name, product_unity=Unity.objects.all().first(), product_quantity=1, product_cp=1.0, product_sp=1.0)
        new_product.save()
        new_product = Product.objects.get(product_id=product_id)
        sale.product = new_product
        sale.save()
        
        for s in Sell.objects.exclude(pk=pk).filter(product_name=sale.product_name):
            s.product_name = None
            s.product = new_product
            s.unit_price=int(s.total_price)/float(s.quantity)
            s.save()
        return redirect("selled-products")
    sale = Sell.objects.get(pk=int(request.GET["pk"]))
    for element in request.GET:
        val = request.GET.get(element, None) if request.GET.get(element, None) not in ["null", "nul"] else None
        if val:
            if element != 'pk' and element != "product":
                setattr(sale, element, val)
            elif element == "product":
                p = Product.objects.get(pk=val)
                sale.product = p
                for s in Sell.objects.exclude(pk=val).filter(product_name=sale.product_name):
                    s.product_name = None
                    s.product = p
                    s.unit_price=int(s.total_price)/float(s.quantity)
                    s.save()
    sale.unit_price=int(sale.total_price)/float(sale.quantity)
    sale.save()
    return JsonResponse({"status": "OK"})

def print_params(request, target, table):
    # Create folder if it doesn't exist
    output_folder = "/var/www/static/pdf_reports/"
    os.makedirs(output_folder, exist_ok=True)

    table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ]))

    # PDF path
    pdf_file = os.path.join(output_folder, f"{target}.pdf")
    pdf = SimpleDocTemplate(pdf_file, pagesize=A4)

    # Build PDF
    pdf.build([table])
    messages.success(request, f"Pdf généré avec success! clickez sur le ce liens http://127.0.0.1:8000/static/pdf_reports/{target}.pdf")

@require_http_methods(["GET"])
@login_required(login_url="/account/login")
def _print(request):
    target = request.GET["target"]
    images_folder = "/var/www/"

    if target == "commande":
        rev = Ravitaillement.objects.all()

        
        # Sample commande list
        commande = []
        for r in rev:
            p_name = r.product_name if not r.product else r.product.product_name
            p_image = "-"
            if not r.product:
                if r.image:
                    p_image = r.image.url
            else:
                p_image = r.product.product_image.url
            commande.append({"Produit":p_name, "Image":f"{images_folder}{p_image}", "Quantité": "...", "Prix":"..........."})

        # Convert to table format
        data = [["Produit", "Image", "Quantité", "Prix (FCFA)"]]
        for item in commande:
            img_cell = reportlab_image(item["Image"], width=25, height=25) if item["Image"] and os.path.exists(item["Image"]) else ""
            data.append([item["Produit"], img_cell, item["Quantité"], item["Prix"]])

        # Create table and style
        col_widths = [300, 50, 70, 70]
        table = Table(data, col_widths)
        print_params(request, target, table)
        return redirect("approvioning")
    elif target == "produits":
        products = Product.objects.all()

        
        # Sample commande list
        commande = []
        for r in products:
            p_name = r.product_name
            p_image = "-"
            if r.product_image:
                p_image = r.product_image.url
            commande.append({"Produit":p_name, "Image":f"{images_folder}{p_image}", "Prix":"..........."})

        # Convert to table format
        data = [["Produit", "Image", "Prix (FCFA)"]]
        for item in commande:
            img_cell = reportlab_image(item["Image"], width=25, height=25) if item["Image"] and os.path.exists(item["Image"]) else ""
            data.append([item["Produit"], img_cell, item["Prix"]])

        # Create table and style
        col_widths = [300, 50, 70]
        table = Table(data, col_widths)
        print_params(request, target, table)
        return redirect("index")
    elif target == "vente":
        rev = Sell.objects.all()

        
        # Sample commande list
        commande = []
        for r in rev:
            p_name = r.product_name if not r.product else r.product.product_name
            p_sell_date = str(r.sell_date).split(" ")[0]
            p_unit_price = r.unit_price
            p_total_price = r.total_price
            p_quantity = r.quantity
            p_customer_name  = r.customer_name 
            commande.append({"Date": p_sell_date, "Produit":p_name, "Client":p_customer_name, "Quantité": p_quantity, "Prix Unitaire":p_unit_price, "Prix Total":p_total_price})

        # Convert to table format
        data = [["date", "Produit", "Client", "Quantité", "Prix Unitaire", "Prix Total"]]
        for item in commande:
            data.append([item["Date"], item["Produit"], item["Client"], item["Quantité"], item["Prix Unitaire"], item["Prix Total"]])

        # Create table and style
        table = Table(data)
        print_params(request, target, table)
        return redirect("selled-products")

@login_required(login_url="/account/login")
def approvioning(request):
    entrances = SupplieEntrance.objects.all()
    if request.method == "GET":
        return render(request, 'approvioning.html', {"ravitaillement": Ravitaillement.objects.all(), "entrances":entrances, "products": Product.objects.all()})
    product_name = request.POST.get("product_name", None)
    product = None
    app = None
    if request.POST["pk"] != "-":
        pk = request.POST.get("pk", None)
        product = Product.objects.get(pk=pk)
        product_name = product.product_name
        app = Ravitaillement(product=product, product_name=None)
    else:
        if product_name:
            product_name = product_name.strip()
            app = Ravitaillement(product_name=product_name)
    for rav in Ravitaillement.objects.all():
        rav_pro_name = rav.product.product_name if rav.product else None
        if product_name.strip() in [rav.product_name, rav_pro_name]:
            return render(request, 'approvioning.html', {"ravitaillement": Ravitaillement.objects.all(), "entrances":entrances, "products": Product.objects.all()})
    if app:
        if not product and product_name:
            image = request.FILES.get('product_image', None)
            if image:
                product_image = resize_image(compress_image(convert_to_jpeg(image)))
                app.image.save(image.name, product_image)
        app.save()
        messages.success(request, "Approvisionnement enregistré avec success!")
    return render(request, 'approvioning.html', {"ravitaillement": Ravitaillement.objects.all(), "entrances":entrances, "products": Product.objects.all()})

@login_required(login_url="/account/login")
def add_approvioning(request):
    name = request.POST.get("supplierName", None)
    phone = request.POST.get("phone", None)
    date = request.POST.get("date", None)
    phone = request.POST.get("phone", None)
    image = request.FILES.get('image', None)
    if not date:
        date = datetime.date.today()
    supplie_entrance = SupplieEntrance(supplier_name=name, Suppler_tel=phone, date=date)
    if image:
        _image = resize_image(compress_image(convert_to_jpeg(image)))
        supplie_entrance.image.save(image.name, _image)
    supplie_entrance.save()
    messages.success(request, "Entré enregistré avec success!")
    return redirect("approvioning")

@login_required(login_url="/account/login")
def update_ravitaillement(request):
    pk = int(request.GET.get("pk", None))
    rav = Ravitaillement.objects.get(pk=pk)
    if "create" in request.GET:
        product_id = "AM"+"-A"+"-1"+"-"+f'{random.randint(1, 99999):05d}'
        new_product = Product(product_id=product_id, product_name=rav.product_name, product_unity=Unity.objects.all().first(), product_quantity=1, product_cp=1.0, product_sp=1.0, product_image=rav.image)
        new_product.save()
    rav.delete()
    messages.success(request, "Opération éffectuée avec succès!")
    return redirect("approvioning")

@login_required(login_url="/account/login")
def products(request):
    _products = Product.objects.all().order_by("product_name")
    products = {product.pk: product.product_name for product in _products}
    return JsonResponse(products)

@login_required(login_url="/account/login")
def selled_products(request):
    salled_product = None
    if 'selledId' in request.GET:
        #salled_product = Sell.objects.get(pk=request.GET['selledId'])
        pass
    date_str = request.GET.get('date')
    if date_str:
        selected_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        selected_date = timezone.now().date()

    sales = Sell.objects.filter(sell_date__date=selected_date)

    total = sales.aggregate(Sum('total_price'))['total_price__sum'] or 0

    sales = Sell.objects.filter(sell_date__date=selected_date)
    benefits = {_sale.pk: [float(_sale.total_price) - (float(_sale.quantity) * float(_sale.product.product_cp)), sum(
        (float(sale.unit_price) - sale.product.product_cp) * sale.quantity
        for sale in sales if sale.pk <= _sale.pk and sale.product
        )] for _sale in sales if _sale.product}
    
    return render(request, 'selled-products.html', {
        'sales': sales,
        'selected_date': selected_date,
        'total': total,
        'benefits': benefits,
        'salled_product': salled_product,
    })

@login_required(login_url="/account/login")
def add_product(request):
    y = f'{random.randint(1, 99999):05d}'
    shelfs = Shelf.objects.all()
    unities = Unity.objects.all()
    if request.method=="POST":
        product_id = "AM"+"-"+request.POST['product_id_etg']+"-"+request.POST['product_id_cas']+"-"+request.POST['product_id']
        product_name = request.POST['product_name'].title()
        product_description = request.POST['product_description']
        product_quantity = int(request.POST['product_quantity'])
        product_company = request.POST['product_company']
        product_sp = float(request.POST['product_sp'])
        product_cp = float(request.POST['product_cp'])
        if request.POST['product_id_etg'] == "NULL" or not request.POST['product_id_cas'] or request.POST['product_unity'] == "NULL":
            messages.error(request, "Les informations sont incomplètes.")
            form_datas = {
                "product_id_etg" : request.POST['product_id_etg'],
                "product_id_cas" : request.POST['product_id_cas'],
                "product_name" : product_name,
                "product_description" : product_description,
                "product_quantity" : product_quantity,
                "product_company" : product_company,
                "product_sp" : product_sp,
                "product_cp" : product_cp
            }
            return render(request, 'add-product.html', {'y':y, 'shelfs': shelfs, 'unities': unities, 'form_datas': form_datas})
        if 'product_image' in request.FILES:
            image = request.FILES['product_image']
            product_image = resize_image(compress_image(convert_to_jpeg(image)))
        if (product_quantity<0 or product_sp<0):
            messages.error(request, "Negative value is not allowed.")
        else:
            product_unity = Unity.objects.filter(name=request.POST['product_unity']).first()
            new_product = Product(product_id=product_id, product_name=product_name, product_description=product_description, product_quantity=product_quantity, product_company=product_company, product_cp=product_cp, product_sp=product_sp, product_unity=product_unity)
            if 'product_image' in request.FILES:
                new_product.product_image.save(image.name, product_image)
            new_product.save()
            messages.success(request, "Product added successfully!")
            return redirect('/add-product')
    form_datas = {
        "product_quantity" : 1,
        "product_sp" : 1,
        "product_cp" : 1
    }
    return render(request, 'add-product.html', {'y':y, 'shelfs': shelfs, 'unities': unities, 'form_datas': form_datas})

@login_required(login_url="/account/login")
def delete_product(request):
    p_id = request.GET['product_id'].upper()
    todelete = Product.objects.get(product_id=p_id)
    todelete.delete()
    return redirect('/')


@login_required(login_url="/account/login")
def update_product(request):
    if request.method=="POST":
        p_id = request.POST['product_id'].upper()
        
        toupdate = Product.objects.get(product_id=p_id)
        
        toupdate.product_name = request.POST['product_name'].title()
        toupdate.product_company = request.POST['product_company']
        toupdate.product_description = request.POST['product_description']
        toupdate.product_cp = request.POST['product_cp']
        toupdate.product_sp = request.POST['product_sp']
        tmp = toupdate.product_id.split("-")
        tmp[1] = request.POST.get("product_etagere", tmp[1])
        tmp[2] = request.POST["product_casier"]
        toupdate.product_id = "-".join(tmp)
        toupdate.product_quantity = request.POST['product_quantity']
        toupdate.product_unity = Unity.objects.filter(name=request.POST.get("product_unity", toupdate.product_unity.name)).first()
        if 'product_image' in request.FILES:
            image = request.FILES['product_image']
            toupdate.product_image.save(image.name, resize_image(compress_image(convert_to_jpeg(image))))
        toupdate.save()
        return redirect('/update-product')
    return render(request, 'update-product.html')


@login_required(login_url="/account/login")
def search_product(request):
    product_id = request.GET['product_id'].upper()
    toupdate = None
    try:
        toupdate = Product.objects.get(product_id=product_id)
    except Product.DoesNotExist:
        messages.error(request, "Product Not Found!")
    shelfs = Shelf.objects.all()
    return render(request, 'update-product.html', {'product': toupdate, 'shelfs': shelfs, 'etagere': toupdate.product_id.split("-")[1], 'unities':Unity.objects.all()})
    


@login_required(login_url="/account/login")
def billing(request):
    context = {}
    return render(request, 'billing.html', context)


@login_required(login_url="/account/login")
def add_new_bill(request):
    if request.method == "POST":
        customer_name = request.POST['customer_name']
        Bill.objects.create(customer_name= customer_name)
        return redirect('/add-product-to-bill')


@login_required(login_url="/account/login")
def existing_bills(request):
    allBills = Bill.objects.all()
    context = {'bills':allBills}
    return render(request, 'existing-bill.html', context)


@login_required(login_url="/account/login")
def add_product_to_bill(request):
    if request.method == "POST":
        billID = request.POST['bill']
        prodID = request.POST['product_id'].upper()
        quantity = request.POST['quantity']

        # to decrease the quantity in stock
        p = Product.objects.get(id=prodID)
        if (int(p.product_quantity) < int(quantity)):
            messages.error(request, "No sufficient products in the stock!")
        else:
            p.product_quantity = int(p.product_quantity) - int(quantity)
            p.save()

            BillItems.objects.create(bill_id= billID, product_id=prodID, quantity=quantity)
            return redirect('/add-product-to-bill')
    return render(request, 'add-product-to-bill.html')


@login_required(login_url="/account/login")
def get_product(request):
    product_id = request.GET['product_id'].upper()
    product = Product.objects.get(product_id=product_id)
    bills = Bill.objects.all()[:5]
    allBills = reversed(bills)
    context = {'product': product, 'bills': allBills}
    return render (request, 'add-product-to-bill.html', context)


@login_required(login_url="/account/login")
def final_bill(request, id):
    billItems = BillItems.objects.filter(bill=Bill.objects.get(id=id))
    grandTotal = 0
    for i in billItems:
        grandTotal += int(i.quantity)*float(i.product.product_sp)
    context = {'items': billItems, 'billId': id, 'g_total':grandTotal}
    return render(request, 'final-bill.html', context)


@login_required(login_url="/account/login")
def print_bill(request, id):
    billItems = BillItems.objects.filter(bill=Bill.objects.get(id=id))
    grandTotal = 0
    for i in billItems:
        grandTotal += int(i.quantity)*float(i.product.product_sp)
    bill = Bill.objects.get(id=id)
    context = {'bill': bill, 'items':billItems, 'g_total':grandTotal}
    return render(request, 'invoice.html', context)
