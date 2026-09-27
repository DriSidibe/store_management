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


def restock(product, quantity, unit_cost):
    """Adds `quantity` units bought at `unit_cost` each and replaces the
    product's cost price by the weighted average of the stock already on hand
    and the new units: (stock x current cost + quantity x unit_cost) /
    (stock + quantity). A stock at or below zero has no value to average with,
    so the new cost is then simply `unit_cost`. Returns (old cost, new cost).
    Call inside a transaction."""
    current = Product.objects.select_for_update().get(pk=product.pk)
    old_cost = current.product_cp
    on_hand = max(current.product_quantity, 0)
    new_cost = round((on_hand * old_cost + quantity * unit_cost) / (on_hand + quantity), 2)
    Product.objects.filter(pk=product.pk).update(
        product_quantity=F('product_quantity') + quantity,
        product_cp=new_cost,
    )
    return old_cost, new_cost


def add_to_stock(product, quantity):
    if product is None or quantity <= 0:
        return
    Product.objects.filter(pk=product.pk).update(product_quantity=F('product_quantity') + quantity)
