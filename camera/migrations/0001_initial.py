# Generated by Django 5.2.3 on 2025-06-17 15:18

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Camera',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True, null=True)),
                ('ip_address', models.GenericIPAddressField()),
                ('resolution', models.CharField(choices=[('UXGA', '1600x1200'), ('SXGA', '1280x1024'), ('HD', '1280x720'), ('XGA', '1024x768'), ('SVGA', '800x600'), ('VGA', '640x480'), ('HVGA', '480x320'), ('CIF', '400x296'), ('QVGA', '320x240'), ('240x240', '240x240'), ('HQVGA', '240x176'), ('QCIF', '176x144'), ('128x128', '128x128'), ('QQVGA', '160x120'), ('96x96', '96x96')], default='VGA', help_text='Select the camera resolution.', max_length=10)),
                ('is_active', models.BooleanField(default=True, help_text='Is the camera currently active?')),
                ('quality', models.IntegerField(default=75, help_text='Quality of the camera stream (1-100).', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(100)])),
                ('brightness', models.IntegerField(default=50, help_text='Brightness level of the camera (0-100).', validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)])),
                ('vflip', models.BooleanField(default=False, help_text='Vertical flip of the camera stream.')),
                ('hflip', models.BooleanField(default=False, help_text='Horizontal flip of the camera stream.')),
            ],
        ),
    ]
