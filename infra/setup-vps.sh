#!/usr/bin/env bash
# ================================================================
# First-time VPS setup for Personal Finance Manager
# Run this once on your Hostinger VPS after SSH'ing in as root.
#
# Usage:  bash setup-vps.sh your-domain.com your-email@example.com
# ================================================================
set -euo pipefail

DOMAIN="${1:?Usage: bash setup-vps.sh <domain> <email>}"
EMAIL="${2:?Usage: bash setup-vps.sh <domain> <email>}"
APP_DIR="$HOME/pfm"

echo "==> Updating system packages..."
apt-get update -y && apt-get upgrade -y

# --- Docker ---
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# --- Create app directory ---
echo "==> Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR/infra/nginx"
mkdir -p "$APP_DIR/infra/certbot/conf"
mkdir -p "$APP_DIR/infra/certbot/www"

# --- Copy nginx config with domain substituted ---
echo "==> Generating Nginx config for $DOMAIN..."
cat > "$APP_DIR/infra/nginx/default.conf" << NGINXEOF
upstream webapp {
    server webapp:3000;
}

server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\\\$host\\\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    client_max_body_size 12M;

    location / {
        proxy_pass http://webapp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
NGINXEOF

# --- Obtain SSL cert (HTTP-only first) ---
echo "==> Obtaining SSL certificate for $DOMAIN..."

# Start a temporary nginx just for ACME challenge
docker run -d --name tmp-nginx \
  -p 80:80 \
  -v "$APP_DIR/infra/certbot/www:/var/www/certbot:ro" \
  nginx:alpine \
  sh -c "echo 'server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"

sleep 2

docker run --rm \
  -v "$APP_DIR/infra/certbot/conf:/etc/letsencrypt" \
  -v "$APP_DIR/infra/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

docker rm -f tmp-nginx

# --- Create .env ---
echo "==> Creating .env file (fill in your Supabase keys)..."
cat > "$APP_DIR/.env" << 'ENVEOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tgkhaxipfgskxydotdtu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_ME

# App
NEXT_PUBLIC_APP_URL=https://REPLACE_WITH_DOMAIN

# Docker
GITHUB_REPO=Cristian1911/personal_finance_manager_claude
ENVEOF

sed -i "s|REPLACE_WITH_DOMAIN|$DOMAIN|" "$APP_DIR/.env"

echo ""
echo "============================================"
echo "  VPS setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env and set your Supabase anon key"
echo "  2. Copy docker-compose.yml to $APP_DIR/"
echo "  3. Set up GitHub Secrets (see VPS-SETUP.md)"
echo "  4. Push to main — GitHub Actions will deploy automatically"
echo ""
