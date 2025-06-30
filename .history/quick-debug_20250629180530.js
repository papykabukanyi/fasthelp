// Quick Railway Debugging Test
console.log('🚨 QUICK RAILWAY DEBUG TEST STARTING...');

// Test 1: Check if we can load Express
try {
    const express = require('express');
    console.log('✅ Express loads correctly');
    
    const app = express();
    console.log('✅ Express app created');
    
    // Test 2: Can we set up a simple route?
    app.get('/debug-test', (req, res) => {
        res.send('DEBUG TEST OK');
    });
    console.log('✅ Simple route configured');
    
    // Test 3: Can we bind to the Railway port?
    const PORT = process.env.PORT || 3000;
    console.log(`🔍 Testing port: ${PORT}`);
    
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ SERVER BOUND TO PORT ${PORT} SUCCESSFULLY!`);
        console.log(`✅ Server listening: ${server.listening}`);
        console.log(`✅ Server address:`, server.address());
        
        // Test the route quickly
        setTimeout(() => {
            const http = require('http');
            const options = {
                hostname: '0.0.0.0',
                port: PORT,
                path: '/debug-test',
                method: 'GET'
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log(`✅ SELF TEST RESULT: ${data}`);
                    console.log('🚀 RAILWAY SHOULD WORK - NO BINDING ISSUES!');
                    server.close();
                    process.exit(0);
                });
            });
            
            req.on('error', (err) => {
                console.log(`❌ SELF TEST FAILED: ${err.message}`);
                server.close();
                process.exit(1);
            });
            
            req.end();
        }, 1000);
    });
    
    server.on('error', (err) => {
        console.log(`❌ PORT BINDING FAILED: ${err.message}`);
        console.log(`❌ Error code: ${err.code}`);
        console.log(`❌ This is likely the Railway issue!`);
        process.exit(1);
    });
    
} catch (error) {
    console.log(`❌ BASIC SETUP FAILED: ${error.message}`);
    process.exit(1);
}

// Timeout in case something hangs
setTimeout(() => {
    console.log('❌ TEST TIMEOUT - Something is hanging');
    process.exit(1);
}, 15000);
