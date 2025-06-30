// RAILWAY DIAGNOSTIC SCRIPT - Find out exactly what's failing
console.log('🔍 RAILWAY DIAGNOSTIC STARTING...');
console.log('================================');

// Environment check
console.log('📊 ENVIRONMENT VARIABLES:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Railway vars:', Object.keys(process.env).filter(k => k.includes('RAILWAY')));

// Dependencies check
console.log('\n📦 DEPENDENCY CHECK:');
try {
    require('express');
    console.log('✅ Express available');
} catch (e) {
    console.log('❌ Express missing:', e.message);
}

// File system check
console.log('\n📁 FILE SYSTEM CHECK:');
const fs = require('fs');
const path = require('path');

const checkFile = (file) => {
    try {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file} exists`);
            return true;
        } else {
            console.log(`❌ ${file} missing`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ${file} error:`, e.message);
        return false;
    }
};

checkFile('package.json');
checkFile('server.js');
checkFile('client/dist/index.html');
checkFile('client/package.json');

// Network test
console.log('\n🌐 NETWORK TEST:');
const PORT = process.env.PORT || 3000;

const express = require('express');
const app = express();

app.get('/diagnostic', (req, res) => {
    res.json({
        status: 'ok',
        port: PORT,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT
        }
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ DIAGNOSTIC SERVER STARTED ON PORT ${PORT}`);
    console.log(`✅ Test URL: http://0.0.0.0:${PORT}/diagnostic`);
    console.log('🔍 RAILWAY DIAGNOSTIC COMPLETE - SERVER RUNNING');
    
    // Self-test
    setTimeout(() => {
        const http = require('http');
        const req = http.request({
            hostname: '0.0.0.0',
            port: PORT,
            path: '/diagnostic',
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('✅ SELF-TEST PASSED:', JSON.parse(data).status);
                console.log('🚀 RAILWAY DEPLOYMENT SHOULD WORK!');
            });
        });
        req.on('error', (err) => {
            console.log('❌ SELF-TEST FAILED:', err.message);
        });
        req.end();
    }, 2000);
});

server.on('error', (err) => {
    console.log('❌ SERVER ERROR:', err.message);
    console.log('❌ ERROR CODE:', err.code);
    process.exit(1);
});
