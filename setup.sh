#!/bin/bash

# Exit immediately if any command fails
set -e

# Print commands as they execute
set -x

echo "=== Deploying Static Files ==="

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# Create directories if they don't exist
echo "Creating directories..."
sudo mkdir -p /var/www/static/
sudo mkdir -p /var/www/media/

# Copy files with preservation of permissions
echo "Copying files..."
sudo cp -r --preserve=mode staticfiles/* /var/www/static/
sudo cp -r --preserve=mode media/* /var/www/media/

# Set up permissions (more secure approach)
echo "Setting permissions..."
sudo usermod -a -G www-data $(whoami)

# Set directory permissions (755)
sudo find /var/www/static/ -type d -exec chmod 755 {} \;
sudo find /var/www/media/ -type d -exec chmod 755 {} \;

# Set file permissions (644)
sudo find /var/www/static/ -type f -exec chmod 644 {} \;
sudo find /var/www/media/ -type f -exec chmod 644 {} \;

# Set ownership
sudo chown -R www-data:www-data /var/www/static/
sudo chown -R www-data:www-data /var/www/media/

echo "=== Static files deployed successfully ==="
echo "You may need to log out and back in for group changes to take effect"