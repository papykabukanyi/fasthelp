// Quick startup test for server.js
console.log('🧪 Testing server startup...');

try {
    // Test if server.js can be loaded without errors
    const server = require('./server.js');
    console.log('✅ Server loaded successfully');
    
    // Give it a moment to start
    setTimeout(() => {
        console.log('✅ Server startup test completed');
        process.exit(0);
    }, 3000);
    
} catch (error) {
    console.error('❌ Server startup failed:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
}
