#!/bin/bash

# HomePro Assist - Backend Startup Script
# This script starts the Firebase emulators (Functions, Firestore, Auth, Storage)

echo "=================================================="
echo "🚀 Starting HomePro Assist - Backend (Firebase)"
echo "=================================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Check if functions node_modules exists
if [ ! -d "functions/node_modules" ]; then
    echo "📦 Installing functions dependencies (first time setup)..."
    echo "This may take 1-2 minutes..."
    cd functions && npm install && cd ..
    echo ""
fi

# Build functions
echo "🔧 Building Cloud Functions..."
cd functions && npm run build && cd ..
echo ""

echo "🔥 Starting Firebase emulators on port 18884..."
echo ""
echo "Firebase services will be available at:"
echo "👉 Functions:   http://localhost:18884"
echo "👉 Firestore:   http://localhost:18880"
echo "👉 Auth:        http://localhost:18899"
echo "👉 Storage:     http://localhost:18898"
echo "👉 Emulator UI: http://localhost:18800"
echo ""
echo "Press Ctrl+C to stop the emulators"
echo "=================================================="
echo ""

# Start Firebase emulators with custom ports
npx firebase-tools emulators:start \
    --only functions,firestore,auth,storage \
    --project demo-homepro
