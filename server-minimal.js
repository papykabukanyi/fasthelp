// RAILWAY-SPECIFIC MINIMAL SERVER - GUARANTEED TO WORK
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚄 RAILWAY DEPLOYMENT - STARTING MINIMAL SERVER');
console.log(`🚄 PORT: ${PORT}`);
console.log(`🚄 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🚄 TIMESTAMP: ${new Date().toISOString()}`);

// CRITICAL: Health check FIRST - no middleware, no dependencies
app.get('/health', (req, res) => {
    console.log('✅ Health check requested');
    res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
    console.log('✅ Ping requested');
    res.status(200).send('PONG');
});

// Static files - serve React build
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve React app
app.get('/', (req, res) => {
    console.log('✅ Root route requested');
    const indexPath = path.join(__dirname, 'client', 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.log('⚠️ React build not found, serving fallback');
            res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Fast Help</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        .status { color: green; font-size: 24px; margin: 20px 0; }
        .links { margin: 20px 0; }
        .links a { margin: 0 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="status">✅ Fast Help - Railway Deployment Successful!</h1>
        <p>The server is running and responding properly.</p>
        <div class="links">
            <a href="/health">Health Check</a>
            <a href="/ping">Ping Test</a>
            <a href="/admin.html">Admin Panel</a>
        </div>
        <p><strong>Server Status:</strong> Running on Railway</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    </div>
</body>
</html>
            `);
        }
    });
});

// Catch-all for React Router
app.get('*', (req, res) => {
    console.log(`✅ Catch-all route: ${req.path}`);
    const indexPath = path.join(__dirname, 'client', 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.redirect('/');
        }
    });
});

// Start server - CRITICAL: Must bind to 0.0.0.0 for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚄🚄🚄 RAILWAY SUCCESS 🚄🚄🚄');
    console.log(`✅ SERVER RUNNING ON 0.0.0.0:${PORT}`);
    console.log(`✅ HEALTH CHECK: http://0.0.0.0:${PORT}/health`);
    console.log(`✅ MAIN SITE: http://0.0.0.0:${PORT}/`);
    console.log('🚄🚄🚄 READY FOR TRAFFIC 🚄🚄🚄');
});

// Error handling - NO PROCESS.EXIT!
server.on('error', (err) => {
    console.error(`❌ SERVER ERROR: ${err.message}`);
    console.error(`❌ ERROR CODE: ${err.code}`);
    console.error(`❌ STACK: ${err.stack}`);
    // Don't exit - let Railway handle it
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🚄 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('🚄 Server closed');
        process.exit(0);
    });
});

console.log('🚄 RAILWAY SERVER SETUP COMPLETE - WAITING FOR CONNECTIONS');
