#!/bin/bash

# Railway-Specific Start Script
# This script ensures proper startup for Railway deployment

echo "🚀 Starting Fast Help for Railway..."

# Set Railway-specific environment variables
export NODE_ENV=production
export GENERATE_SOURCEMAP=false

# Log environment info
echo "📍 Current working directory: $(pwd)"
echo "📍 Node version: $(node --version)"
echo "📍 NPM version: $(npm --version)"
echo "📍 PORT: $PORT"
echo "📍 NODE_ENV: $NODE_ENV"

# Check if server.js exists
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found!"
    exit 1
fi

echo "✅ server.js found"

# Check if client/dist exists (built React app)
if [ ! -d "client/dist" ]; then
    echo "⚠️ client/dist not found - building React app..."
    cd client && npm run build
    cd ..
fi

echo "✅ React app built"

# Start the server
echo "🚀 Starting Node.js server..."
exec node server.js
