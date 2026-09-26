from django.conf import settings
from django.db import models

# Create your models here.
class Customer(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['name'], condition=models.Q(is_deleted=False), name='unique_active_customer_name'
            )
        ]

    def __str__(self):
        return self.name


class ActivityLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=20)
    model_name = models.CharField(max_length=50)
    object_repr = models.CharField(max_length=255)
    details = models.CharField(max_length=255, blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} {self.action} {self.model_name} {self.object_repr}"


class Unity(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name

class Product(models.Model):
    product_id = models.CharField(unique=True, editable=False, max_length=36)
    product_name = models.CharField(max_length=200)
    product_description = models.TextField(blank=True, default="")
    product_unity = models.ForeignKey(Unity, on_delete=models.CASCADE)
    product_category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    product_quantity = models.IntegerField()
    product_company = models.CharField(max_length=264)
    product_cp = models.FloatField()
    product_sp = models.FloatField()
    product_image = models.ImageField(upload_to ='products_images/', blank=True, default=None)
    low_stock_threshold = models.IntegerField(default=5)
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.product_name



class Bill(models.Model):
    customer_name = models.CharField(max_length=255)
    date_created = models.DateTimeField(auto_now=True, blank=True)

    def __str__(self):
        return f"{self.customer_name} {self.date_created}"


class BillItems(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.SET_NULL, null=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity = models.IntegerField(default=0, null=True, blank=True)

    def productInfo(self):
        info = {'name':self.product.product_name, 'price': self.product.product_sp}
        return info

    def billInfo(self):
        info = {'id':self.bill.id, 'name':self.bill.customer_name, 'date':self.bill.date_created}
        return info

    def total(self):
        if not self.product:
            return 0
        return self.quantity*self.product.product_sp
    
class Shelf(models.Model):
    name = models.CharField(max_length=1, unique=True)
    
    def __str__(self):
        return self.name
    

class Sell(models.Model):
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=255, null=True)
    unit_price = models.DecimalField(decimal_places=2, max_digits=10, null=True, blank=True)
    total_price = models.DecimalField(decimal_places=2, default=0, max_digits=10, null=True, blank=True)
    quantity = models.IntegerField(default=0, null=True, blank=True)
    sell_date = models.DateTimeField()
    customer_name = models.CharField(max_length=255, null=True)
    product_image = models.ImageField(upload_to ='products_images/', blank=True, null=True, default=None)
    sold_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    is_deleted = models.BooleanField(default=False)
    # Units this sale has taken out of its product's stock, so edits and
    # deletions give back exactly that. 0 for sales made before stock tracking.
    stock_deducted = models.IntegerField(default=0)

    def productInfo(self):
        info = {'name':self.product.product_name, 'price': self.product.product_sp}
        return info

class Ravitaillement(models.Model):
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=255, null=True)
    commanded_quantity = models.CharField(max_length=255, null=True)
    image = models.ImageField(upload_to ='products_images/', blank=True, null=True, default=None)
    is_deleted = models.BooleanField(default=False)

    def productInfo(self):
        info = {'name':self.product.product_name, 'price': self.product.product_sp}
        return info
    
class SupplieEntrance(models.Model):
    supplier_name = models.CharField(max_length=255, null=True)
    Suppler_tel = models.CharField(max_length=255, null=True)
    image = models.ImageField(upload_to ='products_images/', blank=True, null=True, default=None) 
    date = models.DateTimeField()

    def SupplieEntranceInfo(self):
        info = {'name':self.supplier_name, 'date': self.date}
        return info