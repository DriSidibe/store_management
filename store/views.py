from django.shortcuts import render, redirect
from .models import *
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.paginator import Paginator
from PIL import Image
import io

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


@login_required(login_url="/account/login")
def index(request):
    page_size = 2
    if request.method == 'POST' and 'page_number' not in request.POST:
        if request.POST['product_id'] != '':
            productList = Product.objects.filter(product_id=request.POST['product_id'].upper())
        else:
            productList = Product.objects.filter(product_name__contains=request.POST['prod_name'].title())
    else:
        productList = Product.objects.all()
    context = {'products':Paginator(productList, page_size).get_page(int(request.POST['page_number'][0])) if 'page_number' in request.POST else Paginator(productList, page_size).get_page(1)}
    return render(request, 'dashboard.html', context)


@login_required(login_url="/account/login")
def add_product(request):
    if request.method=="POST":
        image = request.FILES['product_image']
        product_id = request.POST['product_id']
        product_name = request.POST['product_name'].title()
        product_description = request.POST['product_description']
        product_quantity = int(request.POST['product_quantity'])
        product_company = request.POST['product_company']
        product_sp = float(request.POST['product_sp'])
        product_cp = float(request.POST['product_cp'])
        product_image = compress_image(convert_to_jpeg(image))
        if (product_quantity<0 or product_sp<0):
            messages.error(request, "Negative value is not allowed.")
        else:
            
            new_product = Product(product_id=product_id, product_name=product_name, product_description=product_description, product_quantity=product_quantity, product_company=product_company, product_cp=product_cp, product_sp=product_sp)
            new_product.product_image.save(image.name, product_image)
            new_product.save()
            messages.success(request, "Product added successfully!")
            return redirect('/add-product')
    try:
        x = Product.objects.latest('id')
        y = 'AM'+str(int(x.product_id[2:])+1)
    except Product.DoesNotExist:
        y = 'AM1'
    return render(request, 'add-product.html', {'y':y})

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
        toupdate.product_quantity = request.POST['product_quantity']
        if 'product_image' in request.FILES:
            image = request.FILES['product_image']
            toupdate.product_image.save(image.name, compress_image(convert_to_jpeg(image)))
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
    return render(request, 'update-product.html', {'product': toupdate})
    


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
