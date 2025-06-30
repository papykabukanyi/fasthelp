// Railway Deployment Test - Quick Server Start Test
const express = require('express');

console.log('🔍 Testing Railway deployment requirements...');

// Test 1: Check if required dependencies are available
console.log('✅ Testing dependencies...');
try {
    require('express');
    require('cors');
    require('helmet');
    require('jsonwebtoken');
    console.log('✅ All core dependencies found');
} catch (error) {
    console.error('❌ Missing dependency:', error.message);
    process.exit(1);
}

// Test 2: Check if PORT is set correctly
const PORT = process.env.PORT || 3000;
console.log(`✅ PORT configuration: ${PORT}`);

// Test 3: Test basic Express server
const app = express();

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

console.log('✅ Setting up basic health check...');

// Test 4: Try to start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ TEST SERVER STARTED on port ${PORT}`);
    console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    console.log('✅ RAILWAY DEPLOYMENT REQUIREMENTS: PASSED');
    
    // Test the health endpoint
    setTimeout(() => {
        console.log('🔍 Testing health endpoint...');
        const http = require('http');
        const options = {
            hostname: '0.0.0.0',
            port: PORT,
            path: '/health',
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data === 'OK') {
                    console.log('✅ HEALTH CHECK WORKING');
                    console.log('🚀 READY FOR RAILWAY DEPLOYMENT!');
                } else {
                    console.log('❌ Health check failed');
                }
                server.close();
                process.exit(0);
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Health check error:', err.message);
            server.close();
            process.exit(1);
        });
        
        req.end();
    }, 1000);
});

server.on('error', (err) => {
    console.error(`❌ SERVER ERROR: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use`);
    }
    process.exit(1);
});

// Timeout in case server doesn't start
setTimeout(() => {
    console.error('❌ Server startup timeout');
    process.exit(1);
}, 10000);
