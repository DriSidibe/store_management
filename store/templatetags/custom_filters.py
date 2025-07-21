from django import template

register = template.Library()

@register.filter
def split(value, key):
    return value.split(key)

@register.filter
def intcomma(value):
    try:
        return "{:,.0f}".format(float(value)).replace(",", " ")
    except:
        return value

@register.filter
def calc_total(products, field_name):
    return sum(getattr(p, field_name, 0) for p in products)

@register.filter
def calc_total_price(products, field_pair):
    try:
        field1, field2 = field_pair.split(',')
        total = sum(getattr(p, field1, 0) * getattr(p, field2, 0) for p in products)
        return "{:,.0f}".format(total).replace(",", " ")
    except:
        return 0
    
@register.filter
def get_item(dictionary, key):
    return dictionary.get(key, 0)
