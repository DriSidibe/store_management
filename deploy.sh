#!/bin/bash

# Exit on error and print commands
set -e
set -x

# Install required packages
echo "Installing dependencies..."
pip install gunicorn
sudo apt update
sudo apt install -y nginx

# Create Nginx configuration file
echo "Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/store_management"
sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name localhost 192.168.64.108;

    client_max_body_size 100M;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    location /static/ {
        alias /var/www/static/;
        expires 30d;
        access_log off;
    }

    location /media/ {
        alias /var/www/media/;
        expires 30d;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# Set up symbolic link
echo "Enabling site configuration..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/

# Create directories for static and media files
echo "Creating static and media directories..."
sudo mkdir -p /var/www/static/
sudo mkdir -p /var/www/media/
sudo chown -R $USER:$USER /var/www/static/
sudo chown -R $USER:$USER /var/www/media/
sudo chmod -R 755 /var/www/

# Test and restart Nginx
echo "Restarting Nginx..."
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Set up Gunicorn as a systemd service
sudo tee /etc/systemd/system/store_management.service > /dev/null <<EOF
[Unit]
Description=gunicorn daemon
After=network.target

[Service]
User=$USER
Group=www-data
WorkingDirectory=/home/drissa/Documents/Projects/store_management
ExecStart=/usr/local/bin/gunicorn --access-logfile - --workers 3 --bind unix:/home/drissa/Documents/Projects/store_management.sock store_management.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start store_management
sudo systemctl enable store_management

echo "Setup completed successfully!"