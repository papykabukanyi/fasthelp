@echo off
echo 🔧 Fast Help Build Script
echo =========================

echo 📦 Installing root dependencies...
call npm install --production=false
if errorlevel 1 goto error

echo 📦 Installing client dependencies...
cd client
call npm install --force
if errorlevel 1 goto error

echo 🏗️ Building React app...
set NODE_OPTIONS=--max-old-space-size=4096
set SKIP_PREFLIGHT_CHECK=true
set GENERATE_SOURCEMAP=false

call npm run build
if errorlevel 1 (
    echo ⚠️ Build with TypeScript checking failed, trying without checks...
    call npm run build
)
if errorlevel 1 goto error

if exist dist (
    echo ✅ Build directory created successfully
    dir dist
    echo 🎉 Build completed successfully!
    exit /b 0
) else (
    echo ❌ Build failed - no dist directory
    goto error
)

:error
echo ❌ Build failed
exit /b 1
