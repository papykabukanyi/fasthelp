#!/bin/bash

# Fast Help - Railway Deployment Script
# This script helps verify everything is ready for Railway deployment

echo "🚀 Fast Help - Railway Deployment Verification"
echo "==============================================="

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this script from the fasthelp root directory."
    exit 1
fi

echo "✅ Found server.js"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found."
    exit 1
fi

echo "✅ Found package.json"

# Check if client directory exists
if [ ! -d "client" ]; then
    echo "❌ Error: client directory not found."
    exit 1
fi

echo "✅ Found client directory"

# Check if client/package.json exists
if [ ! -f "client/package.json" ]; then
    echo "❌ Error: client/package.json not found."
    exit 1
fi

echo "✅ Found client/package.json"

# Check Railway configuration files
if [ ! -f "nixpacks.toml" ]; then
    echo "❌ Error: nixpacks.toml not found."
    exit 1
fi

echo "✅ Found nixpacks.toml"

if [ ! -f "railway.json" ]; then
    echo "❌ Error: railway.json not found."
    exit 1
fi

echo "✅ Found railway.json"

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    echo "⚠️  Warning: .env.example not found (recommended for documentation)"
else
    echo "✅ Found .env.example"
fi

echo ""
echo "🔍 IMPORTANT DEPLOYMENT REMINDERS:"
echo "=================================="
echo ""
echo "1. 🔑 REQUIRED: Set JWT_SECRET in Railway dashboard"
echo "   - Go to your Railway project → Variables tab"
echo "   - Add: JWT_SECRET = [32+ character random string]"
echo ""
echo "2. 🔗 OPTIONAL: Add Redis service in Railway if you want caching"
echo "   - Add Redis service in Railway dashboard"
echo "   - Copy REDIS_URL to environment variables"
echo ""
echo "3. 🌐 DO NOT SET: PORT (Railway sets this automatically)"
echo ""
echo "4. ✅ HEALTH CHECK: Railway will check /health endpoint"
echo ""
echo "📋 DEPLOYMENT CHECKLIST:"
echo "========================"
echo "[ ] Repository connected to Railway"
echo "[ ] JWT_SECRET environment variable set (32+ chars)"
echo "[ ] Optional: REDIS_URL set if using Redis"
echo "[ ] Optional: EMAIL_FROM, ADMIN_EMAIL, ADMIN_PASSWORD set"
echo "[ ] Ready to deploy!"
echo ""
echo "🎯 AFTER DEPLOYMENT - TEST THESE URLS:"
echo "======================================"
echo "https://yourapp.railway.app/          → Main React app"
echo "https://yourapp.railway.app/health    → Should return 'OK'"
echo "https://yourapp.railway.app/status    → Server status page"
echo "https://yourapp.railway.app/admin.html → Admin panel"
echo ""
echo "🚨 IF DEPLOYMENT FAILS WITH '502 Application failed to respond':"
echo "================================================================"
echo "1. Check Railway deploy logs for error messages"
echo "2. Verify JWT_SECRET is set (required for server to start)"
echo "3. Wait 2-3 minutes for build to complete"
echo "4. Check that health endpoint responds: /health"
echo "5. If still failing, try redeploying once more"
echo ""
echo "✅ All files are ready for Railway deployment!"
echo "🚀 Deploy now in your Railway dashboard!"
