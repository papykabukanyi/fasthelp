const express = require('express');
const path = require('path');
const redis = require('redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🚀 Fast Help Server Starting...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', NODE_ENV);

// Health Check Endpoints (FIRST)
app.get('/health', (req, res) => {
    res.status(200).type('text/plain').send('OK');
});

app.get('/ping', (req, res) => {
    res.status(200).type('text/plain').send('PONG');
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow React to load
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Redis Connection (Optional)
let redisClient = null;
if (process.env.REDIS_URL) {
    try {
        redisClient = redis.createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 5000,
                commandTimeout: 5000
            }
        });
        
        redisClient.on('error', (err) => {
            console.log('Redis connection error (non-fatal):', err.message);
        });
        
        redisClient.connect().catch(err => {
            console.log('Redis connection failed (non-fatal):', err.message);
        });
    } catch (error) {
        console.log('Redis setup failed (non-fatal):', error.message);
    }
}

// In-memory storage for demo (replace with database in production)
const users = [];
const donations = [];
const sessions = new Map();

// Utility Functions
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// API Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, address, userType } = req.body;
        
        // Check if user exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Create new user
        const userId = uuidv4();
        const user = {
            id: userId,
            name,
            email,
            phone,
            address,
            userType: userType || 'donor',
            status: 'active',
            joinDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };
        
        users.push(user);
        
        // Generate token
        const token = generateToken(userId);
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { ...user }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user (for demo, we'll skip password verification)
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate token
        const token = generateToken(user.id);
        
        res.json({
            message: 'Login successful',
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Donation Routes
app.get('/api/donations', authenticateToken, (req, res) => {
    try {
        const userDonations = donations.filter(d => d.userId === req.user.userId);
        res.json(userDonations);
    } catch (error) {
        console.error('Get donations error:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

app.post('/api/donations', authenticateToken, (req, res) => {
    try {
        const { foodType, quantity, pickupTime, description } = req.body;
        
        const donation = {
            id: uuidv4(),
            userId: req.user.userId,
            foodType,
            quantity,
            pickupTime,
            description: description || '',
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        donations.push(donation);
        
        res.status(201).json({
            message: 'Donation created successfully',
            donation
        });
    } catch (error) {
        console.error('Create donation error:', error);
        res.status(500).json({ error: 'Failed to create donation' });
    }
});

// Admin Routes
app.get('/api/admin/stats', (req, res) => {
    try {
        const stats = {
            totalUsers: users.length,
            totalDonations: donations.length,
            activeDonors: users.filter(u => u.userType === 'donor' && u.status === 'active').length,
            pendingRequests: donations.filter(d => d.status === 'pending').length
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/admin/users', (req, res) => {
    try {
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:userId/status', (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        
        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.status = status;
        
        res.json({
            message: 'User status updated successfully',
            user
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Serve React App (Production)
if (NODE_ENV === 'production') {
    // Serve static files from React build
    app.use(express.static(path.join(__dirname, 'client/dist')));
    
    // Catch all handler: send back React's index.html file for client-side routing
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/dist/index.html'));
    });
} else {
    // Development: Serve a simple message
    app.get('/', (req, res) => {
        res.send(`
            <html>
                <head><title>Fast Help API Server</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>🍽️ Fast Help API Server</h1>
                    <p>Server is running in development mode.</p>
                    <p>React app should be running on <a href="http://localhost:5173">http://localhost:5173</a></p>
                    <h2>API Endpoints:</h2>
                    <ul>
                        <li><a href="/health">/health</a> - Health check</li>
                        <li><a href="/ping">/ping</a> - Ping test</li>
                        <li>POST /api/auth/register - User registration</li>
                        <li>POST /api/auth/login - User login</li>
                        <li>GET /api/donations - Get donations</li>
                        <li>POST /api/donations - Create donation</li>
                        <li>GET /api/admin/stats - Admin stats</li>
                        <li>GET /api/admin/users - Admin users</li>
                    </ul>
                </body>
            </html>
        `);
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Fast Help Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${NODE_ENV}`);
    console.log('🚀 Server ready for requests!');
});

server.on('error', (err) => {
    console.error('❌ Server startup error:', err);
    process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
        console.log('🔚 HTTP server closed.');
        
        if (redisClient) {
            redisClient.quit().finally(() => {
                console.log('🔚 Redis connection closed.');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
