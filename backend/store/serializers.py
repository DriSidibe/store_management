from rest_framework import serializers

from .models import (
    ActivityLog, Bill, BillItems, Customer, Product, Ravitaillement, Sell, Shelf,
    SupplieEntrance, Unity,
)
from .utils import build_product_id, generate_product_id, process_product_image


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'notes', 'created_at']
        read_only_fields = ['created_at']


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', default=None, read_only=True)

    class Meta:
        model = ActivityLog
        fields = ['id', 'username', 'action', 'model_name', 'object_repr', 'details', 'timestamp']


class UnitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Unity
        fields = ['id', 'name']


class ShelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shelf
        fields = ['id', 'name']


class ProductSerializer(serializers.ModelSerializer):
    product_unity_name = serializers.CharField(source='product_unity.name', read_only=True)
    # Only used on create: the two segments of the composite product_id
    # that aren't the fixed "AM" prefix or the random sequence number.
    product_id_etg = serializers.CharField(write_only=True, required=False)
    product_id_cas = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'id', 'product_id', 'product_id_etg', 'product_id_cas', 'product_name',
            'product_description', 'product_unity', 'product_unity_name',
            'product_quantity', 'product_company', 'product_cp', 'product_sp',
            'product_image', 'low_stock_threshold',
        ]
        read_only_fields = ['product_id']

    def validate_product_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Negative value is not allowed.")
        return value

    def validate_product_sp(self, value):
        if value < 0:
            raise serializers.ValidationError("Negative value is not allowed.")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get('product_id_etg'):
            raise serializers.ValidationError("Les informations sont incomplètes.")
        return attrs

    def create(self, validated_data):
        etage = validated_data.pop('product_id_etg')
        casier = validated_data.pop('product_id_cas', '')
        image = validated_data.pop('product_image', None)
        validated_data['product_name'] = validated_data['product_name'].title()
        validated_data['product_id'] = generate_product_id(etage, casier)
        product = Product.objects.create(**validated_data)
        if image:
            product.product_image.save(image.name, process_product_image(image), save=True)
        return product

    def update(self, instance, validated_data):
        etage = validated_data.pop('product_id_etg', None)
        casier = validated_data.pop('product_id_cas', None)
        image = validated_data.pop('product_image', None)
        if 'product_name' in validated_data:
            validated_data['product_name'] = validated_data['product_name'].title()
        if etage is not None or casier is not None:
            tmp = instance.product_id.split('-')
            new_etage = etage if etage is not None else tmp[1]
            new_casier = casier if casier is not None else tmp[2]
            instance.product_id = build_product_id(new_etage, new_casier, tmp[3])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if image:
            instance.product_image.save(image.name, process_product_image(image), save=False)
        instance.save()
        return instance


class SellSerializer(serializers.ModelSerializer):
    product_name_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Sell
        fields = [
            'id', 'product', 'product_name', 'product_name_display', 'unit_price',
            'total_price', 'quantity', 'sell_date', 'customer_name', 'product_image',
        ]
        read_only_fields = ['unit_price']

    def get_product_name_display(self, obj):
        return obj.product.product_name if obj.product else obj.product_name

    def create(self, validated_data):
        image = validated_data.pop('product_image', None)
        quantity = validated_data.get('quantity') or 0
        total_price = validated_data.get('total_price') or 0
        validated_data['unit_price'] = (
            float(total_price) / float(quantity) if quantity else 0
        )
        sell = Sell.objects.create(**validated_data)
        if image:
            sell.product_image.save(image.name, process_product_image(image), save=True)
        return sell

    def update(self, instance, validated_data):
        image = validated_data.pop('product_image', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        quantity = float(instance.quantity or 0)
        if quantity:
            instance.unit_price = float(instance.total_price or 0) / quantity
        if image:
            instance.product_image.save(image.name, process_product_image(image), save=False)
        instance.save()
        return instance


class RavitaillementSerializer(serializers.ModelSerializer):
    product_name_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Ravitaillement
        fields = [
            'id', 'product', 'product_name', 'product_name_display',
            'commanded_quantity', 'image',
        ]

    def get_product_name_display(self, obj):
        return obj.product.product_name if obj.product else obj.product_name

    def validate(self, attrs):
        product = attrs.get('product')
        product_name = attrs.get('product_name')
        if product_name:
            product_name = product_name.strip()
            attrs['product_name'] = product_name
        if self.instance is None:
            target_name = product.product_name if product else product_name
            for rav in Ravitaillement.objects.all():
                rav_name = rav.product.product_name if rav.product else rav.product_name
                if target_name in [rav.product_name, rav_name]:
                    raise serializers.ValidationError(
                        "Ce produit est déjà en cours d'approvisionnement."
                    )
        return attrs

    def create(self, validated_data):
        image = validated_data.pop('image', None)
        if validated_data.get('product'):
            validated_data['product_name'] = None
        rav = Ravitaillement.objects.create(**validated_data)
        if image and not rav.product:
            rav.image.save(image.name, process_product_image(image), save=True)
        return rav


class SupplieEntranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplieEntrance
        fields = ['id', 'supplier_name', 'Suppler_tel', 'image', 'date']

    def create(self, validated_data):
        image = validated_data.pop('image', None)
        entrance = SupplieEntrance.objects.create(**validated_data)
        if image:
            entrance.image.save(image.name, process_product_image(image), save=True)
        return entrance


class BillItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField(read_only=True)
    product_sp = serializers.SerializerMethodField(read_only=True)
    total = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BillItems
        fields = ['id', 'bill', 'product', 'product_name', 'product_sp', 'quantity', 'total']

    def get_product_name(self, obj):
        return obj.product.product_name if obj.product else 'Produit supprimé'

    def get_product_sp(self, obj):
        return obj.product.product_sp if obj.product else 0

    def get_total(self, obj):
        return obj.total()


class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = ['id', 'customer_name', 'date_created']
        read_only_fields = ['date_created']
