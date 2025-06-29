// MINIMAL TEST SERVER FOR RAILWAY DEBUGGING
const express = require('express');
const app = express();

// Use Railway's PORT or default to 3000
const PORT = process.env.PORT || 3000;

console.log('=== MINIMAL TEST SERVER STARTING ===');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All PORT env vars:', Object.keys(process.env).filter(key => key.includes('PORT')));

// Ultra-simple health check
app.get('/health', (req, res) => {
    console.log('Health check hit');
    res.status(200).send('OK');
});

// Ultra-simple ping
app.get('/ping', (req, res) => {
    console.log('Ping hit');
    res.status(200).send('PONG');
});

// Root route
app.get('/', (req, res) => {
    console.log('Root route hit');
    res.status(200).send('MINIMAL TEST SERVER WORKING');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== MINIMAL SERVER STARTED ON PORT ${PORT} ===`);
    console.log('Server is ready for requests');
});
