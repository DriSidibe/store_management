# Generated by Django 2.2.13 on 2024-07-18 15:20

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0003_auto_20240716_1849'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='product_image',
            field=models.ImageField(blank=True, default='', upload_to='products_images/'),
        ),
    ]
