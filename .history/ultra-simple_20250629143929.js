// ULTRA SIMPLE SERVER FOR RAILWAY - NO DEPENDENCIES
const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('Ultra simple server starting...');
console.log('PORT:', PORT);

const server = http.createServer((req, res) => {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${req.url} from ${req.connection.remoteAddress}`);
    
    // Set response headers
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
    });
    
    if (req.url === '/health') {
        res.end('OK');
    } else if (req.url === '/ping') {
        res.end('PONG');
    } else if (req.url === '/') {
        res.end('ULTRA SIMPLE SERVER WORKING - Railway Success!');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ultra simple server listening on 0.0.0.0:${PORT}`);
    console.log('Ready for requests!');
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
