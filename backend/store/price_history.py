from .models import Product, ProductPriceChange


def record_price_change(product, user, reason, old_cost=None, old_selling=None, note=''):
    """Records the product's current prices against the ones it had before
    (`old_cost`/`old_selling`, None for a creation). Nothing is recorded when
    neither price actually changed, except for a creation."""
    current = Product.objects.get(pk=product.pk)
    unchanged = old_cost == current.product_cp and old_selling == current.product_sp
    if reason != ProductPriceChange.Reason.CREATED and unchanged:
        return
    ProductPriceChange.objects.create(
        product=current,
        changed_by=user if user and user.is_authenticated else None,
        reason=reason,
        old_cost_price=old_cost,
        new_cost_price=current.product_cp,
        old_selling_price=old_selling,
        new_selling_price=current.product_sp,
        note=note,
    )
