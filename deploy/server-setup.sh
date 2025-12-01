#!/bin/bash

# Server Setup Script for diyyid.io
# Run this ONCE on the server (68.32.2.33) to set up nginx and SSL

set -e

echo "=================================================="
echo "🔧 Setting up server for diyyid.io"
echo "=================================================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install nginx
echo "🌐 Installing nginx..."
sudo apt-get install -y nginx

# Install certbot for SSL
echo "🔒 Installing certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# Create web directory
echo "📁 Creating web directory..."
sudo mkdir -p /var/www/diyyid.io/dist
sudo chown -R $USER:$USER /var/www/diyyid.io

# Copy nginx config
echo "⚙️  Configuring nginx..."
sudo cp /tmp/nginx-diyyid.conf /etc/nginx/sites-available/diyyid.io
sudo ln -sf /etc/nginx/sites-available/diyyid.io /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config (will fail until SSL is set up, that's ok)
echo ""
echo "🔒 Setting up SSL certificate..."
echo "Note: Make sure DNS is pointing to this server first!"
echo ""

# Get SSL certificate
sudo certbot --nginx -d diyyid.io -d www.diyyid.io --non-interactive --agree-tos --email admin@diyyid.io

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx

# Enable firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

echo ""
echo "=================================================="
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Run deploy.sh from your local machine to upload the app"
echo "2. Visit https://diyyid.io"
echo "=================================================="
