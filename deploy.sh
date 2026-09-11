#!/bin/bash
#
# Deploys store_management on a Linux server: builds the frontend, sets up
# the Python backend, and configures Nginx + Gunicorn (systemd) in front of
# it. Safe to re-run for updates (git pull && ./deploy.sh).
#
# Requires: the repo checked out on the server, and backend/.env already
# filled in (copy backend/.env.example, set a real SECRET_KEY,
# DEBUG=False, IS_PRODUCTION=True, ALLOWED_HOSTS).
#
# Override defaults by exporting before running, e.g.:
#   DOMAIN=store.example.com DEPLOY_USER=deploy ./deploy.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
ENV_FILE="$BACKEND_DIR/.env"

DEPLOY_USER="${DEPLOY_USER:-$USER}"
DOMAIN="${DOMAIN:-_}"          # nginx server_name; "_" matches any hostname/IP
SERVICE_NAME="store_management"
GUNICORN_SOCK="$BACKEND_DIR/store_management.sock"
MIN_NODE_MAJOR=18

log() { echo -e "\n==> $*"; }
fail() { echo -e "\n!! $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE is missing. Copy backend/.env.example to backend/.env, fill in SECRET_KEY / ALLOWED_HOSTS / IS_PRODUCTION=True, then re-run."
grep -q '^SECRET_KEY=change-me' "$ENV_FILE" && fail "SECRET_KEY in $ENV_FILE is still the placeholder value. Set a real secret before deploying."
grep -q '^IS_PRODUCTION=True' "$ENV_FILE" || echo "!! Warning: IS_PRODUCTION is not set to True in $ENV_FILE - media files will be written under backend/media instead of a shared path."

log "Deploying store_management from $PROJECT_DIR (domain: $DOMAIN, user: $DEPLOY_USER)"

# --- 1. System packages ------------------------------------------------------
log "Installing system packages..."
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx curl

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//;s/\..*//')" -lt "$MIN_NODE_MAJOR" ]; then
    fail "Node.js >= $MIN_NODE_MAJOR is required to build the frontend (found: $(node -v 2>/dev/null || echo 'not installed')).
   Install it first, e.g. via NodeSource:
     curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
     sudo apt install -y nodejs"
fi

# --- 2. Backend: venv, deps, migrations, static ------------------------------
log "Setting up backend..."
[ -d "$VENV_DIR" ] || python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip --quiet
pip install -r "$BACKEND_DIR/requirements.txt" --quiet
pip install gunicorn --quiet

(cd "$BACKEND_DIR" && python manage.py migrate --noinput)
(cd "$BACKEND_DIR" && python manage.py collectstatic --noinput --clear)
deactivate

# --- 3. Frontend build --------------------------------------------------------
log "Building frontend..."
(cd "$FRONTEND_DIR" && npm ci && npm run build)

# --- 4. Media directory & permissions -----------------------------------------
MEDIA_ROOT="$(grep '^MEDIA_ROOT=' "$ENV_FILE" | cut -d= -f2- || true)"
MEDIA_ROOT="${MEDIA_ROOT:-/var/www/media}"
log "Ensuring media directory $MEDIA_ROOT exists..."
sudo mkdir -p "$MEDIA_ROOT"
sudo chown -R "$DEPLOY_USER:www-data" "$MEDIA_ROOT"
sudo chmod -R 775 "$MEDIA_ROOT"
sudo chown -R "$DEPLOY_USER:www-data" "$BACKEND_DIR/staticfiles"
sudo chmod -R 755 "$BACKEND_DIR/staticfiles"

# --- 5. Nginx ------------------------------------------------------------------
log "Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE_NAME"
sudo tee "$NGINX_CONF" > /dev/null <<EOF
upstream ${SERVICE_NAME}_app {
    server unix:$GUNICORN_SOCK;
}

server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 100M;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/manifest+json;

    location = /favicon.ico { access_log off; log_not_found off; }

    location /static/ {
        alias $BACKEND_DIR/staticfiles/;
        expires 30d;
        access_log off;
    }

    location /media/ {
        alias $MEDIA_ROOT/;
        expires 30d;
        access_log off;
    }

    location /api/ {
        proxy_pass http://${SERVICE_NAME}_app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /admin/ {
        proxy_pass http://${SERVICE_NAME}_app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Service worker must never be cached, or clients get stuck on old builds.
    location = /sw.js {
        add_header Cache-Control "no-cache";
        root $FRONTEND_DIR/dist;
    }

    location / {
        root $FRONTEND_DIR/dist;
        try_files \$uri /index.html;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$SERVICE_NAME"
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx --quiet

# --- 6. Gunicorn systemd service ----------------------------------------------
log "Configuring Gunicorn systemd service..."
sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null <<EOF
[Unit]
Description=gunicorn daemon for store_management
After=network.target

[Service]
User=$DEPLOY_USER
Group=www-data
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/gunicorn \\
    --access-logfile - \\
    --workers 3 \\
    --bind unix:$GUNICORN_SOCK \\
    store_management.wsgi:application
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl enable "$SERVICE_NAME" --quiet

# --- 7. Health check -----------------------------------------------------------
log "Checking that the service came up..."
sleep 2
if ! sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    fail "$SERVICE_NAME failed to start - check: sudo journalctl -u $SERVICE_NAME -n 50"
fi
if ! curl -sf -o /dev/null "http://127.0.0.1/admin/login/" -H "Host: ${DOMAIN/_/localhost}"; then
    echo "!! Warning: Nginx didn't respond as expected on http://127.0.0.1/ - check: sudo journalctl -u nginx -n 50"
fi

echo ""
echo "Deployment complete."
echo "  - App:    http://$DOMAIN/"
echo "  - Admin:  http://$DOMAIN/admin/"
echo "  - Logs:   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "First-time setup, if needed:"
echo "  cd $BACKEND_DIR && source .venv/bin/activate && python manage.py createsuperuser"
echo ""
echo "For HTTPS, once DNS points at this server:"
echo "  sudo apt install -y certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d $DOMAIN"
