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
