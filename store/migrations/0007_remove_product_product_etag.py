# Generated by Django 5.1.7 on 2025-03-20 15:01

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0006_shelf'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='product',
            name='product_etag',
        ),
    ]
