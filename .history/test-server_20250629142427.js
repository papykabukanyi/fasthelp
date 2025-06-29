// MINIMAL TEST SERVER FOR RAILWAY DEBUGGING
const express = require('express');
const app = express();

// Use Railway's PORT or default to 3000
const PORT = process.env.PORT || 3000;

console.log('=== MINIMAL TEST SERVER STARTING ===');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars with PORT:', Object.keys(process.env).filter(key => key.includes('PORT')));

// Basic middleware
app.use(express.json({ limit: '1mb' }));

// Ultra-simple health check - Railway uses this
app.get('/health', (req, res) => {
    console.log(`[${new Date().toISOString()}] Health check hit from ${req.ip}`);
    res.status(200).type('text/plain').send('OK');
});

// Ultra-simple ping
app.get('/ping', (req, res) => {
    console.log(`[${new Date().toISOString()}] Ping hit from ${req.ip}`);
    res.status(200).type('text/plain').send('PONG');
});

// Test endpoint
app.get('/test', (req, res) => {
    console.log(`[${new Date().toISOString()}] Test hit from ${req.ip}`);
    res.status(200).type('text/plain').send('TEST');
});

// Root route
app.get('/', (req, res) => {
    console.log(`[${new Date().toISOString()}] Root route hit from ${req.ip}`);
    res.status(200).type('text/plain').send('MINIMAL TEST SERVER WORKING - Railway Deployment Success');
});

// Catch all other routes
app.get('*', (req, res) => {
    console.log(`[${new Date().toISOString()}] Unknown route hit: ${req.path} from ${req.ip}`);
    res.status(404).type('text/plain').send('Route not found in minimal test server');
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).type('text/plain').send('Internal Server Error');
});

// Start server with better error handling
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== MINIMAL SERVER STARTED ON PORT ${PORT} ===`);
    console.log(`Server listening on 0.0.0.0:${PORT}`);
    console.log('Server is ready for requests');
    console.log('Available endpoints: /, /health, /ping, /test');
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
