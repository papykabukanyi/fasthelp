#!/bin/bash
set -e

echo "🚀 Railway Build & Start Script"
echo "================================"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: ${NODE_ENV:-development}"

# Install root dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install --production=false
fi

# Build client if in production
if [ "$NODE_ENV" = "production" ]; then
    echo "🏗️ Building React app for production..."
    cd client
    
    # Install client dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing client dependencies..."
        npm install
    fi
    
    # Build React app
    echo "🏗️ Building React app..."
    npm run build
    
    cd ..
    echo "✅ Build completed!"
fi

echo "🚀 Starting server..."
exec node server.js
