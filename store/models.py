from django.db import models

# Create your models here.
class Unity(models.Model):
    name = models.CharField(max_length=255, unique=True)
    
    def __str__(self):
        return self.name

class Product(models.Model):
    product_id = models.CharField(unique=True, editable=False, max_length=36)
    product_name = models.CharField(max_length=200)
    product_description = models.TextField(blank=True, default="")
    product_unity = models.ForeignKey(Unity, on_delete=models.CASCADE)
    product_quantity = models.IntegerField()
    product_company = models.CharField(max_length=264)
    product_cp = models.FloatField()
    product_sp = models.FloatField()
    product_image = models.ImageField(upload_to ='products_images/', blank=True, default=None) 

    def __str__(self):
        return self.product_name



class Bill(models.Model):
    customer_name = models.CharField(max_length=255)
    date_created = models.DateTimeField(auto_now=True, blank=True)

    def __str__(self):
        return self.customer_name+self.date_created


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
    sell_date = models.DateTimeField(auto_now=True)
    customer_name = models.CharField(max_length=255, null=True)

    def productInfo(self):
        info = {'name':self.product.product_name, 'price': self.product.product_sp}
        return info
    
class Ravitaillement(models.Model):
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=255, null=True)
    commanded_quantity = models.CharField(max_length=255, null=True)
    image = models.ImageField(upload_to ='products_images/', blank=True, null=True, default=None) 

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