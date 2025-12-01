#!/bin/bash

# HomePro Assist (diyyid.io) - Deployment Script
# Run this script to build and deploy to the server

set -e

echo "=================================================="
echo "🚀 Deploying HomePro Assist to diyyid.io"
echo "=================================================="
echo ""

# Configuration
SERVER_IP="68.32.2.33"
SERVER_USER="root"  # Change this to your SSH user
DEPLOY_PATH="/var/www/diyyid.io"
PROJECT_DIR="$(dirname "$0")/.."

# Build the project
echo "📦 Building production bundle..."
cd "$PROJECT_DIR"
npm run build

echo ""
echo "📤 Uploading to server..."

# Create directory on server if it doesn't exist
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${DEPLOY_PATH}"

# Upload the dist folder
rsync -avz --delete dist/ ${SERVER_USER}@${SERVER_IP}:${DEPLOY_PATH}/dist/

echo ""
echo "🔄 Reloading nginx..."
ssh ${SERVER_USER}@${SERVER_IP} "sudo nginx -t && sudo systemctl reload nginx"

echo ""
echo "=================================================="
echo "✅ Deployment complete!"
echo "👉 https://diyyid.io"
echo "=================================================="
