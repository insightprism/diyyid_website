#!/bin/bash

# HomePro Assist - Frontend Startup Script
# This script starts the React frontend development server

echo "=================================================="
echo "🚀 Starting HomePro Assist - Frontend"
echo "=================================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first time setup)..."
    echo "This may take 2-3 minutes..."
    npm install
    echo ""
fi

echo "🌐 Starting development server on port 18885..."
echo ""
echo "Once started, open your browser to:"
echo "👉 http://localhost:18885"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

# Start the development server
npm run dev
