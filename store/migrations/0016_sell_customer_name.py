# Generated by Django 5.2.4 on 2025-07-22 12:04

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0015_remove_sell_cumuled_benefit_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sell',
            name='customer_name',
            field=models.CharField(max_length=255, null=True),
        ),
    ]
