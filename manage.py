#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import time
import requests
from store_management import settings
import threading


def scheddle_():
    enable = False
    while True:
        try:
            current_hour = time.localtime().tm_hour
            if current_hour >= 19 and enable:
                requests.get(f'http://{settings.ALLOWED_HOSTS[-1]}:8000/camera/stop_all/')
                enable = False
            elif current_hour >= 7 and current_hour < 19 and not enable:
                requests.get(f'http://{settings.ALLOWED_HOSTS[-1]}:8000/camera/start_all/')
                enable = True
        except requests.RequestException as e:
            print("Error to background checker")
        time.sleep(60)


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'store_management.settings')
    try:
        from django.core.management import execute_from_command_line
        #threading.Thread(target=scheddle_, daemon=True).start()
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()