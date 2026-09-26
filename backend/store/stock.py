from django.db.models import F
from rest_framework.exceptions import ValidationError

from .models import Product


def remove_from_stock(product, quantity):
    """Takes `quantity` units out of the product's stock, refusing to go below
    zero. Call inside a transaction so a refusal rolls back the whole sale."""
    if product is None or quantity <= 0:
        return
    current = Product.objects.select_for_update().get(pk=product.pk)
    if current.product_quantity < quantity:
        raise ValidationError({
            'quantity': f"Stock insuffisant pour « {current.product_name} » : "
                        f"il en reste {current.product_quantity}.",
        })
    Product.objects.filter(pk=product.pk).update(product_quantity=F('product_quantity') - quantity)


def add_to_stock(product, quantity):
    if product is None or quantity <= 0:
        return
    Product.objects.filter(pk=product.pk).update(product_quantity=F('product_quantity') + quantity)
