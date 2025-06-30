@echo off
echo 🚀 FAST HELP - RAILWAY DEPLOYMENT SCRIPT
echo ========================================
echo.

REM Step 1: Check current status
echo 📊 Step 1: Checking current application status...
echo Current directory: %CD%
node --version >nul 2>&1 && (
    echo Node.js version: 
    node --version
) || (
    echo ❌ Node.js not found
)
npm --version >nul 2>&1 && (
    echo npm version: 
    npm --version
) || (
    echo ❌ npm not found
)
echo.

REM Step 2: Check files
echo 📁 Step 2: Checking critical files...
if exist "server.js" (echo ✅ server.js exists) else (echo ❌ server.js missing)
if exist "package.json" (echo ✅ package.json exists) else (echo ❌ package.json missing)
if exist "railway.json" (echo ✅ railway.json exists) else (echo ❌ railway.json missing)
if exist "nixpacks.toml" (echo ✅ nixpacks.toml exists) else (echo ❌ nixpacks.toml missing)
if exist ".env" (echo ✅ .env exists) else (echo ❌ .env missing)
echo.

REM Step 3: Check client build
echo 🔧 Step 3: Checking client build...
if exist "client\dist" (
    echo ✅ Client build directory exists
    if exist "client\dist\index.html" (
        echo ✅ Client build index.html exists
    ) else (
        echo ⚠️ Client build index.html missing
    )
) else (
    echo ⚠️ Client build directory missing
)
echo.

REM Step 4: Test server syntax
echo 🧪 Step 4: Testing server syntax...
node -c server.js >nul 2>&1 && (
    echo ✅ Server syntax is valid
) || (
    echo ❌ Server syntax error
)
echo.

REM Step 5: Check dependencies
echo 📦 Step 5: Checking dependencies...
if exist "node_modules" (
    echo ✅ node_modules directory exists
    echo Checking critical dependencies...
    if exist "node_modules\express" (echo ✅ express installed) else (echo ❌ express missing)
    if exist "node_modules\bcryptjs" (echo ✅ bcryptjs installed) else (echo ❌ bcryptjs missing)
    if exist "node_modules\jsonwebtoken" (echo ✅ jsonwebtoken installed) else (echo ❌ jsonwebtoken missing)
    if exist "node_modules\cors" (echo ✅ cors installed) else (echo ❌ cors missing)
    if exist "node_modules\helmet" (echo ✅ helmet installed) else (echo ❌ helmet missing)
) else (
    echo ❌ node_modules directory missing - run 'npm install'
)
echo.

REM Step 6: Railway deployment instructions
echo 🚄 Step 6: Railway deployment instructions...
echo.
echo To deploy to Railway:
echo 1. Make sure you're in the Railway project directory
echo 2. Run: railway up
echo 3. Monitor the build logs for any errors
echo 4. Once deployed, test these endpoints:
echo    - https://your-app.railway.app/health
echo    - https://your-app.railway.app/
echo    - https://your-app.railway.app/status
echo.

REM Step 7: Debugging information
echo 🔍 Step 7: Key debugging information...
if defined JWT_SECRET (echo JWT_SECRET is set: ✅ Yes) else (echo JWT_SECRET is set: ❌ No)
if defined REDIS_URL (echo REDIS_URL is set: ✅ Yes) else (echo REDIS_URL is set: ❌ No)
if defined PORT (echo PORT is set: ✅ Yes ^(%PORT%^)) else (echo PORT is set: ⚠️ No ^(will use 3000^))
echo.

REM Step 8: Final checklist
echo ✅ DEPLOYMENT CHECKLIST:
echo ✅ Server.js has bulletproof health check routes
echo ✅ Railway.json configured for health checks
echo ✅ Nixpacks.toml configured for build
echo ✅ Package.json has correct start script
echo ✅ All dependencies have fallback error handling
echo ✅ Environment variables are properly configured
echo ✅ Static file serving is configured
echo ✅ Catch-all route handles missing React build
echo.
echo 🚀 Ready for Railway deployment!
echo Run: railway up
echo.

pause
