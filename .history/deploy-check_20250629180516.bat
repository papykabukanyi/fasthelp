@echo off
echo.
echo 🚀 Fast Help - Railway Deployment Verification
echo ===============================================

REM Check if we're in the right directory
if not exist "server.js" (
    echo ❌ Error: server.js not found. Please run this script from the fasthelp root directory.
    pause
    exit /b 1
)

echo ✅ Found server.js

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ Error: package.json not found.
    pause
    exit /b 1
)

echo ✅ Found package.json

REM Check if client directory exists
if not exist "client" (
    echo ❌ Error: client directory not found.
    pause
    exit /b 1
)

echo ✅ Found client directory

REM Check if client/package.json exists
if not exist "client\package.json" (
    echo ❌ Error: client/package.json not found.
    pause
    exit /b 1
)

echo ✅ Found client/package.json

REM Check Railway configuration files
if not exist "nixpacks.toml" (
    echo ❌ Error: nixpacks.toml not found.
    pause
    exit /b 1
)

echo ✅ Found nixpacks.toml

if not exist "railway.json" (
    echo ❌ Error: railway.json not found.
    pause
    exit /b 1
)

echo ✅ Found railway.json

REM Check if .env.example exists
if not exist ".env.example" (
    echo ⚠️  Warning: .env.example not found (recommended for documentation^)
) else (
    echo ✅ Found .env.example
)

echo.
echo 🔍 IMPORTANT DEPLOYMENT REMINDERS:
echo ==================================
echo.
echo 1. 🔑 REQUIRED: Set JWT_SECRET in Railway dashboard
echo    - Go to your Railway project → Variables tab
echo    - Add: JWT_SECRET = 5d0789c1ffab37f8ae49416910c28facd57a20ff65a7498af21551fb552a3086
echo    - (Or generate your own 32+ character secret key^)
echo.
echo 2. 🔗 OPTIONAL: Add Redis service in Railway if you want caching
echo    - Add Redis service in Railway dashboard
echo    - Copy REDIS_URL to environment variables
echo.
echo 3. 🌐 DO NOT SET: PORT (Railway sets this automatically^)
echo.
echo 4. ✅ HEALTH CHECK: Railway will check /health endpoint
echo.
echo 📋 DEPLOYMENT CHECKLIST:
echo ========================
echo [ ] Repository connected to Railway
echo [ ] JWT_SECRET environment variable set (32+ chars^)
echo [ ] Optional: REDIS_URL set if using Redis
echo [ ] Optional: EMAIL_FROM, ADMIN_EMAIL, ADMIN_PASSWORD set
echo [ ] Ready to deploy!
echo.
echo 🎯 AFTER DEPLOYMENT - TEST THESE URLS:
echo ======================================
echo https://yourapp.railway.app/          → Main React app
echo https://yourapp.railway.app/health    → Should return 'OK'
echo https://yourapp.railway.app/status    → Server status page
echo https://yourapp.railway.app/admin.html → Admin panel
echo.
echo ✅ All files are ready for Railway deployment!
echo 🚀 Deploy now in your Railway dashboard!
echo.
echo 🚨 DEBUGGING MODE: Will run quick-debug.js first to identify issues
echo 🔍 Check Railway logs for detailed debug output
echo 🔍 Test debug endpoint: https://yourapp.railway.app/debug-test
echo.
pause
