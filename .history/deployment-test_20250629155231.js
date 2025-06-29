#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

console.log('🔍 Fast Help Deployment Test');
console.log('============================');

// Check if all required files exist
const requiredFiles = [
    'server-new.js',
    'package.json',
    'client/package.json',
    'client/vite.config.ts',
    'client/src/App.tsx',
    'railway.json',
    'nixpacks.toml'
];

console.log('\n📁 Checking required files:');
let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesExist = false;
    }
});

// Check package.json scripts
console.log('\n📦 Checking package.json scripts:');
const rootPackage = JSON.parse(fs.readFileSync('package.json'));
const requiredScripts = ['start', 'build', 'railway-build', 'install-client'];

requiredScripts.forEach(script => {
    if (rootPackage.scripts[script]) {
        console.log(`✅ ${script}: ${rootPackage.scripts[script]}`);
    } else {
        console.log(`❌ ${script} - MISSING`);
        allFilesExist = false;
    }
});

// Check client package.json
console.log('\n⚛️ Checking client configuration:');
if (fs.existsSync('client/package.json')) {
    const clientPackage = JSON.parse(fs.readFileSync('client/package.json'));
    const requiredDeps = ['react', 'react-dom', 'react-router-dom', 'axios', 'tailwindcss'];
    
    requiredDeps.forEach(dep => {
        if (clientPackage.dependencies[dep]) {
            console.log(`✅ ${dep}: ${clientPackage.dependencies[dep]}`);
        } else {
            console.log(`❌ ${dep} - MISSING`);
            allFilesExist = false;
        }
    });
}

// Check environment variables
console.log('\n🌍 Environment Configuration:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`PORT: ${process.env.PORT || 'not set (will use 3000)'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'not set (will use fallback)'}`);
console.log(`REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'not set (will skip Redis)'}`);

// Check Railway configuration
console.log('\n🚂 Railway Configuration:');
if (fs.existsSync('railway.json')) {
    const railwayConfig = JSON.parse(fs.readFileSync('railway.json'));
    console.log(`✅ Start command: ${railwayConfig.deploy.startCommand}`);
    console.log(`✅ Health check: ${railwayConfig.deploy.healthcheckPath}`);
    console.log(`✅ Restart policy: ${railwayConfig.deploy.restartPolicyType}`);
}

// Check Nixpacks configuration
console.log('\n📦 Nixpacks Configuration:');
if (fs.existsSync('nixpacks.toml')) {
    console.log('✅ nixpacks.toml exists');
    const nixpacksContent = fs.readFileSync('nixpacks.toml', 'utf8');
    if (nixpacksContent.includes('nodejs-18_x')) {
        console.log('✅ Node.js 18 configured');
    }
    if (nixpacksContent.includes('npm install')) {
        console.log('✅ npm install configured');
    }
    if (nixpacksContent.includes('npm run build')) {
        console.log('✅ Build step configured');
    }
}

console.log('\n🎯 Summary:');
if (allFilesExist) {
    console.log('✅ All checks passed! Ready for Railway deployment.');
    console.log('\n🚀 Next steps:');
    console.log('1. Push to GitHub');
    console.log('2. Deploy to Railway');
    console.log('3. Set environment variables in Railway dashboard');
    console.log('4. Check deployment logs');
} else {
    console.log('❌ Some issues found. Please fix them before deploying.');
}

process.exit(allFilesExist ? 0 : 1);
