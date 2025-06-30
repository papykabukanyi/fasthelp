const express = require('express');
const path = require('path');
const redis = require('redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Optional EmailTemplateHelper - graceful fallback if missing
let EmailTemplateHelper;
try {
    EmailTemplateHelper = require('./email-template-helper');
    console.log('✅ EmailTemplateHelper loaded successfully');
} catch (error) {
    console.log('⚠️ EmailTemplateHelper not found, using fallback');
    EmailTemplateHelper = {
        loadTemplate: () => '<html><body>Email template not available</body></html>',
        processTemplate: (template, data) => template
    };
}

require('dotenv').config();

const app = express();
// Railway sets PORT environment variable - we must use it exactly as provided
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Debug: Log all environment variables related to Railway
console.log('🔍 RAILWAY DEBUG INFO:');
console.log('PORT from Railway:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Will listen on PORT:', PORT);
console.log('Railway env vars:', Object.keys(process.env).filter(key => key.includes('RAILWAY')));

// CRITICAL: Health check endpoints FIRST - before ANY middleware
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Ultra-simple ping endpoint
app.get('/ping', (req, res) => {
    res.status(200).send('PONG');
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.status(200).send('WORKING');
});

// Status endpoint for debugging (separate from main site)
app.get('/status', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`📊 STATUS ENDPOINT REQUESTED at ${timestamp}`);
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Fast Help - Server Status</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin: 50px auto; max-width: 600px; }
        .status { color: green; font-size: 24px; font-weight: bold; margin: 20px 0; }
        .info { color: #666; margin: 10px 0; }
        .links { margin: 30px 0; }
        .links a { margin: 0 10px; padding: 5px 10px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
    </style>
</head>
<body>
    <h1 class="status">✅ Fast Help Server Status</h1>
    <div class="info">Port: ${PORT}</div>
    <div class="info">Environment: ${NODE_ENV}</div>
    <div class="info">Time: ${timestamp}</div>
    <div class="links">
        <a href="/">Main Website</a>
        <a href="/health">Health Check</a>
        <a href="/ping">Ping Test</a>
        <a href="/admin.html">Admin Panel</a>
    </div>
    <div class="info">🚀 Server is operational!</div>
</body>
</html>`;
    
    res.set('Content-Type', 'text/html');
    res.status(200).send(html);
});

// Main website root route - serve the React application
app.get('/', (req, res) => {
    console.log(`🏠 MAIN WEBSITE REQUESTED at ${new Date().toISOString()}`);
    console.log(`📍 From: ${req.ip || req.connection.remoteAddress}`);
    
    // In production, serve the React build
    if (NODE_ENV === 'production') {
        const reactIndexPath = path.join(__dirname, 'client', 'dist', 'index.html');
        res.sendFile(reactIndexPath, (err) => {
            if (err) {
                console.error('❌ Error serving React app:', err);
                // Fallback to original index.html
                res.sendFile(path.join(__dirname, 'public', 'index.html'), (fallbackErr) => {
                    if (fallbackErr) {
                        console.error('❌ Error serving fallback index.html:', fallbackErr);
                        res.status(500).send('Error loading website');
                    }
                });
            } else {
                console.log('✅ Served React app successfully');
            }
        });
    } else {
        // In development, serve the original index.html
        res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
            if (err) {
                console.error('❌ Error serving index.html:', err);
                res.status(500).send('Error loading website');
            } else {
                console.log('✅ Served index.html successfully');
            }
        });
    }
});

// Request logging middleware for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip || req.connection.remoteAddress}`);
    next();
});

// Comprehensive request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📨 INCOMING REQUEST at ${timestamp}`);
    console.log(`🌐 Method: ${req.method}`);
    console.log(`📍 Path: ${req.path}`);
    console.log(`🏠 Host: ${req.get('host')}`);
    console.log(`🔄 User-Agent: ${req.get('user-agent')}`);
    console.log(`📧 IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`📦 Headers:`, JSON.stringify(req.headers, null, 2));
    
    // Log when response is sent
    const originalSend = res.send;
    res.send = function(data) {
        console.log(`📤 SENDING RESPONSE for ${req.method} ${req.path} at ${new Date().toISOString()}`);
        console.log(`📊 Status: ${res.statusCode}`);
        console.log(`📝 Data length:`, typeof data === 'string' ? data.length : 'non-string');
        return originalSend.call(this, data);
    };
    
    next();
});

// Redis connection - made optional for Railway deployment
const REDIS_URL = process.env.REDIS_URL || '';
let redisAvailable = false;

if (REDIS_URL && REDIS_URL.includes('redis://')) {
    redisAvailable = true;
    console.log('✅ Redis URL configured');
} else {
    console.log('⚠️ No valid Redis URL - running without Redis cache');
}

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'fasthelp-secret-key-change-in-production';
if (JWT_SECRET === 'fasthelp-secret-key-change-in-production' && NODE_ENV === 'production') {
    console.warn('Using default JWT_SECRET in production. Please set a secure JWT_SECRET environment variable.');
}

// Logging function
function log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...meta
    };
    
    if (NODE_ENV === 'production') {
        console.log(JSON.stringify(logEntry));
    } else {
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
    }
}

// Log startup information
log('info', 'Starting Fast Help application', {
    nodeVersion: process.version,
    platform: process.platform,
    environment: NODE_ENV,
    port: PORT,
    hasRedisUrl: !!REDIS_URL,
    hasJwtSecret: !!JWT_SECRET
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for now to allow inline scripts
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API health check with Redis status (detailed)
app.get('/api/health', async (req, res) => {
    console.log('API health check requested');
    try {
        let redisStatus = 'disconnected';
        
        // Check Redis only if client exists and is connected
        if (redisClient && redisClient.isReady) {
            try {
                const pingResult = await redisClient.ping();
                redisStatus = pingResult === 'PONG' ? 'connected' : 'disconnected';
            } catch (redisErr) {
                log('warn', 'Redis ping failed in health check', { error: redisErr.message });
                redisStatus = 'error';
            }
        }
        
        res.status(200).json({
            status: 'healthy',
            services: {
                redis: redisStatus,
                database: 'connected'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        log('error', 'Health check error', { error: error.message });
        res.status(503).json({
            status: 'unhealthy',
            error: 'Service unavailable',
            timestamp: new Date().toISOString()
        });
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from React build (production)
if (NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client', 'dist')));
    console.log('✅ React static files enabled for production');
}

// Redis connection (REDIS_URL already declared at top)
if (!REDIS_URL.includes('redis://')) {
    log('error', 'Invalid REDIS_URL format');
    process.exit(1);
}
let redisClient;

// Connect to Redis (made completely optional)
async function connectRedis() {
    try {
        // Skip Redis entirely if not available
        if (!redisAvailable || !REDIS_URL) {
            log('info', 'Skipping Redis connection - not configured or available');
            return false;
        }
        
        log('info', 'Attempting Redis connection...', { url: REDIS_URL.replace(/:[^:]*@/, ':***@') });
        
        redisClient = redis.createClient({
            url: REDIS_URL,
            socket: {
                tls: false,
                rejectUnauthorized: false,
                connectTimeout: 5000, // Reduced timeout
                lazyConnect: true
            }
        });

        redisClient.on('error', (err) => {
            log('warn', 'Redis Client Error (non-fatal)', { error: err.message });
            redisClient = null; // Disable Redis on error
        });

        redisClient.on('connect', () => {
            log('info', 'Connected to Redis successfully');
        });

        await redisClient.connect();
        log('info', 'Redis connection established');
        return true;
    } catch (err) {
        log('warn', 'Redis connection failed - server will continue without Redis', { error: err.message });
        redisClient = null;
        return false;
    }
}

// Initialize Redis connection (non-blocking)
connectRedis().then((connected) => {
    if (connected) {
        log('info', 'Redis connection successful');
    } else {
        log('warn', 'Starting server without Redis - some features may not work');
    }
}).catch((err) => {
    log('error', 'Redis connection failed but server will continue', { error: err.message });
});

// JWT secret (JWT_SECRET already declared at top)
if (JWT_SECRET === 'fasthelp-secret-key-change-in-production' && NODE_ENV === 'production') {
    log('warn', 'Using default JWT_SECRET in production. Please set a secure JWT_SECRET environment variable.');
}

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Redis Helper Functions
class RedisHelper {
    // Check if Redis is available
    static isRedisAvailable() {
        return redisClient && redisClient.isReady;
    }
    
    // Handle Redis unavailable scenarios
    static handleNoRedis(operation) {
        log('warn', `Redis operation '${operation}' skipped - Redis not available`);
        // Return appropriate fallback values
        switch (operation) {
            case 'createUser':
            case 'createDonation':
            case 'createPickup':
                return { id: uuidv4(), created: true, error: 'Redis unavailable - data not persisted' };
            case 'getUsers':
            case 'getDonations':
                return [];
            case 'getUser':
            case 'getDonation':
            case 'getPickup':
                return null;
            case 'updateUser':
            case 'updateDonation':
            case 'updatePickup':
                return { updated: false, error: 'Redis unavailable' };
            default:
                return null;
        }
    }
    
    // Users
    static async createUser(userData) {
        if (!this.isRedisAvailable()) {
            return this.handleNoRedis('createUser');
        }
        
        try {
            const userId = uuidv4();
            const user = {
                id: userId,
                ...userData,
                isApproved: userData.isApproved ? 'true' : 'false',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const userForRedis = {};
            Object.keys(user).forEach(key => {
                userForRedis[key] = String(user[key]);
            });
            
            await redisClient.hSet(`user:${userId}`, userForRedis);
            await redisClient.sAdd('users:all', userId);
            await redisClient.hSet('users:email', userData.email, userId);
            await redisClient.hSet('users:username', userData.username, userId);
            
            if (userData.isApproved !== true) {
                await redisClient.sAdd('users:pending', userId);
            }
            
            return { ...user, _id: userId };
        } catch (error) {
            log('error', 'Error creating user in Redis', { error: error.message });
            return this.handleNoRedis('createUser');
        }
    }
    
    static async getUserById(userId) {
        if (!this.isRedisAvailable()) {
            return this.handleNoRedis('getUser');
        }
        
        try {
            const user = await redisClient.hGetAll(`user:${userId}`);
            return Object.keys(user).length ? { ...user, _id: userId } : null;
        } catch (error) {
            log('error', 'Error getting user by ID from Redis', { error: error.message });
            return null;
        }
    }
    
    static async getUserByEmail(email) {
        if (!this.isRedisAvailable()) {
            return this.handleNoRedis('getUser');
        }
        
        try {
            const userId = await redisClient.hGet('users:email', email);
            return userId ? await this.getUserById(userId) : null;
        } catch (error) {
            log('error', 'Error getting user by email from Redis', { error: error.message });
            return null;
        }
    }
    
    static async getUserByUsername(username) {
        const userId = await redisClient.hGet('users:username', username);
        return userId ? await this.getUserById(userId) : null;
    }
    
    static async updateUser(userId, updateData) {
        const updates = {};
        Object.keys(updateData).forEach(key => {
            updates[key] = String(updateData[key]);
        });
        updates.updatedAt = new Date().toISOString();
        
        await redisClient.hSet(`user:${userId}`, updates);
        return await this.getUserById(userId);
    }
    
    static async getAllUsers() {
        const userIds = await redisClient.sMembers('users:all');
        const users = [];
        for (const userId of userIds) {
            const user = await this.getUserById(userId);
            if (user) users.push(user);
        }
        return users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    static async approveUser(userId) {
        await redisClient.sRem('users:pending', userId);
        return await this.updateUser(userId, { isApproved: 'true' });
    }
    
    static async deleteUser(userId) {
        const user = await this.getUserById(userId);
        if (!user) return false;
        
        // Remove from all sets
        await redisClient.sRem('users:all', userId);
        await redisClient.sRem('users:pending', userId);
        
        // Remove email and username mappings
        if (user.email) {
            await redisClient.hDel('users:email', user.email);
        }
        if (user.username) {
            await redisClient.hDel('users:username', user.username);
        }
        
        // Delete user data
        await redisClient.del(`user:${userId}`);
        
        return true;
    }
    
    // Donations
    static async createDonation(donationData) {
        const donationId = uuidv4();
        const donation = {
            id: donationId,
            ...donationData,
            lat: String(donationData.lat),
            lng: String(donationData.lng),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Convert all values to strings for Redis
        const donationForRedis = {};
        Object.keys(donation).forEach(key => {
            donationForRedis[key] = String(donation[key]);
        });
        
        await redisClient.hSet(`donation:${donationId}`, donationForRedis);
        await redisClient.sAdd('donations:all', donationId);
        
        // Only add to available set if status is 'available' or 'approved'
        if (donation.status === 'available' || donation.status === 'approved') {
            await redisClient.sAdd('donations:available', donationId);
        }
        
        // Add to geospatial index for location-based queries only if approved
        if ((donation.status === 'available' || donation.status === 'approved') && donation.lat && donation.lng) {
            await redisClient.geoAdd('donations:geo', {
                longitude: parseFloat(donation.lng),
                latitude: parseFloat(donation.lat),
                member: donationId
            });
        }
        
        return { ...donation, _id: donationId };
    }
    
    static async getDonationById(donationId) {
        const donation = await redisClient.hGetAll(`donation:${donationId}`);
        return Object.keys(donation).length ? { ...donation, _id: donationId } : null;
    }
    
    static async getAvailableDonations(lat = null, lng = null, radius = 10) {
        let donationIds;
        
        if (lat && lng) {
            // Get donations within radius (in km)
            donationIds = await redisClient.geoRadius('donations:geo', {
                longitude: parseFloat(lng),
                latitude: parseFloat(lat)
            }, radius, 'km');
            donationIds = donationIds.map(item => item.member);
        } else {
            donationIds = await redisClient.sMembers('donations:available');
        }
        
        const donations = [];
        for (const donationId of donationIds) {
            const donation = await this.getDonationById(donationId);
            if (donation && donation.status === 'available') {
                donations.push(donation);
            }
        }
        
        return donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    static async updateDonationStatus(donationId, status, additionalData = {}) {
        const updates = {
            status,
            ...additionalData,
            updatedAt: new Date().toISOString()
        };
        
        // Convert all values to strings for Redis
        const updatesForRedis = {};
        Object.keys(updates).forEach(key => {
            updatesForRedis[key] = String(updates[key]);
        });
        
        await redisClient.hSet(`donation:${donationId}`, updatesForRedis);
        
        if (status === 'picked_up') {
            await redisClient.sRem('donations:available', donationId);
            await redisClient.sAdd('donations:picked_up', donationId);
        }
        
        return await this.getDonationById(donationId);
    }
    
    static async updateDonation(donationId, updateData) {
        const updates = {};
        Object.keys(updateData).forEach(key => {
            updates[key] = String(updateData[key]);
        });
        updates.updatedAt = new Date().toISOString();
        
        await redisClient.hSet(`donation:${donationId}`, updates);
        return await this.getDonationById(donationId);
    }
    
    static async deleteDonation(donationId) {
        const donation = await this.getDonationById(donationId);
        if (!donation) return false;
        
        // Remove from all sets
        await redisClient.sRem('donations:all', donationId);
        await redisClient.sRem('donations:available', donationId);
        await redisClient.sRem('donations:picked_up', donationId);
        
        // Remove from geospatial index
        await redisClient.zRem('donations:geo', donationId);
        
        // Delete donation data
        await redisClient.del(`donation:${donationId}`);
        
        return true;
    }

    // Pickups/Tracking
    static async createPickup(pickupData) {
        const trackingId = uuidv4();
        const pickup = {
            id: trackingId,
            ...pickupData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Convert all values to strings for Redis
        const pickupForRedis = {};
        Object.keys(pickup).forEach(key => {
            pickupForRedis[key] = String(pickup[key]);
        });
        
        await redisClient.hSet(`pickup:${trackingId}`, pickupForRedis);
        await redisClient.sAdd('pickups:all', trackingId);
        
        return { ...pickup, _id: trackingId };
    }
    
    static async getPickupById(trackingId) {
        const pickup = await redisClient.hGetAll(`pickup:${trackingId}`);
        return Object.keys(pickup).length ? { ...pickup, _id: trackingId } : null;
    }
    
    static async updatePickup(trackingId, updateData) {
        const updates = {};
        Object.keys(updateData).forEach(key => {
            updates[key] = String(updateData[key]);
        });
        updates.updatedAt = new Date().toISOString();
        
        await redisClient.hSet(`pickup:${trackingId}`, updates);
        return await this.getPickupById(trackingId);
    }
    
    // Settings
    static async saveSetting(type, data) {
        const setting = {
            type,
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        // Convert all values to strings for Redis
        const settingForRedis = {};
        Object.keys(setting).forEach(key => {
            settingForRedis[key] = String(setting[key]);
        });
        
        await redisClient.hSet(`setting:${type}`, settingForRedis);
        return setting;
    }
    
    static async getSetting(type) {
        const setting = await redisClient.hGetAll(`setting:${type}`);
        return Object.keys(setting).length ? setting : null;
    }
    
    // Stats
    static async getStats() {
        const [
            totalUsers,
            pendingUsers,
            totalDonations,
            availableDonations,
            pickedUpDonations,
            totalPickups
        ] = await Promise.all([
            redisClient.sCard('users:all'),
            redisClient.sCard('users:pending'),
            redisClient.sCard('donations:all'),
            redisClient.sCard('donations:available'),
            redisClient.sCard('donations:picked_up'),
            redisClient.sCard('pickups:all')
        ]);
        
        // Count pending donations by checking all donations for 'pending' status
        const allDonationIds = await redisClient.sMembers('donations:all');
        let pendingDonations = 0;
        
        for (const donationId of allDonationIds) {
            const donation = await redisClient.hGetAll(`donation:${donationId}`);
            if (donation.status === 'pending') {
                pendingDonations++;
            }
        }
        
        return {
            totalUsers,
            pendingUsers,
            activeDonations: availableDonations,
            pendingDonations,
            totalDonations,
            pickedUpDonations,
            totalPickups
        };
    }
}

// Helper function to safely execute Redis operations
async function safeRedisOperation(operation, fallback = null) {
    if (!redisClient || !redisClient.isReady) {
        log('warn', 'Redis operation skipped - client not available');
        return fallback;
    }
    
    try {
        return await operation();
    } catch (error) {
        log('error', 'Redis operation failed', { error: error.message });
        return fallback;
    }
}

// Middleware for authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Email transporter (will be configured from admin panel)
let emailTransporter = null;

// Function to get email configuration from Redis
async function getEmailConfig() {
    try {
        const config = await RedisHelper.getSetting('email');
        if (config && config.smtp) {
            const smtpConfig = JSON.parse(config.smtp);
            emailTransporter = nodemailer.createTransporter(smtpConfig);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error getting email config:', error);
        return false;
    }
}

// Function to send email
async function sendEmail(to, subject, html, attachments = []) {
    try {
        if (!emailTransporter) {
            await getEmailConfig();
        }
        
        if (!emailTransporter) {
            console.error('Email transporter not configured');
            return false;
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'noreply@fasthelp.com',
            to,
            subject,
            html,
            attachments
        };

        await emailTransporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

// Function to send donation notification emails
async function sendDonationNotificationEmails(donation) {
    try {
        // Get all active notification subscribers
        const activeEmails = await redisClient.sMembers('notifications:active_emails');
        
        if (!activeEmails || activeEmails.length === 0) {
            console.log('No notification subscribers found');
            return;
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const subject = '🍽️ New Food Donation Available in Austin!';

        // Send emails to all subscribers (in batches to avoid overwhelming the SMTP server)
        const batchSize = 10;
        let successCount = 0;
        
        for (let i = 0; i < activeEmails.length; i += batchSize) {
            const batch = activeEmails.slice(i, i + batchSize);
            
            const emailPromises = batch.map(async (email) => {
                try {
                    const html = await EmailTemplateHelper.sendDonationNotification(donation, email, baseUrl);
                    if (html) {
                        const success = await sendEmail(email, subject, html);
                        if (success) successCount++;
                        return success;
                    }
                    return false;
                } catch (error) {
                    console.error(`Failed to send notification to ${email}:`, error);
                    return false;
                }
            });
            
            await Promise.all(emailPromises);
            
            // Small delay between batches
            if (i + batchSize < activeEmails.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`Donation notification sent to ${successCount}/${activeEmails.length} subscribers for donation: ${donation.title}`);
        
    } catch (error) {
        console.error('Error sending donation notification emails:', error);
    }
}

// Austin, TX bounds for validation
const AUSTIN_BOUNDS = {
    north: 30.5149,
    south: 30.0986,
    east: -97.5691,
    west: -97.9383
};

// Function to check if coordinates are within Austin
function isWithinAustin(lat, lng) {
    return lat >= AUSTIN_BOUNDS.south && 
           lat <= AUSTIN_BOUNDS.north && 
           lng >= AUSTIN_BOUNDS.west && 
           lng <= AUSTIN_BOUNDS.east;
}

// API Routes

// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, username, email, phone, password } = req.body;

        // Validate input
        if (!fullName || !username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUserByEmail = await RedisHelper.getUserByEmail(email);
        const existingUserByUsername = await RedisHelper.getUserByUsername(username);

        if (existingUserByEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        if (existingUserByUsername) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const userData = {
            fullName,
            username,
            email,
            phone: phone || '',
            password: hashedPassword,
            role: 'donor',
            isApproved: false // Requires admin approval
        };

        const user = await RedisHelper.createUser(userData);

        // Send welcome email
        const welcomeHtml = await EmailTemplateHelper.sendWelcomeEmail(fullName);
        if (welcomeHtml) {
            await sendEmail(email, 'Welcome to Fast Help - Account Pending Approval', welcomeHtml);
        }

        res.status(201).json({
            message: 'Registration successful! Your account is pending approval.',
            userId: user._id
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await RedisHelper.getUserByEmail(email);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user is approved (admin users are always approved)
        if (user.role !== 'admin' && user.isApproved !== 'true') {
            if (user.isApproved === 'denied') {
                return res.status(401).json({ error: 'Your account has been denied access' });
            } else {
                return res.status(401).json({ error: 'Your account is pending approval' });
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Update last login
        await RedisHelper.updateUser(user._id, { lastLogin: new Date().toISOString() });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Notification subscription
app.post('/api/subscribe-notifications', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if already subscribed
        const existingSubscription = await redisClient.hGet('notifications:subscribers', email);
        if (existingSubscription) {
            return res.status(200).json({ message: 'Already subscribed to notifications' });
        }

        // Add to notification subscribers
        const subscriptionData = {
            email,
            subscribedAt: new Date().toISOString(),
            isActive: 'true'
        };

        await redisClient.hSet('notifications:subscribers', email, JSON.stringify(subscriptionData));
        await redisClient.sAdd('notifications:active_emails', email);

        console.log(`New notification subscriber: ${email}`);

        res.status(201).json({
            message: 'Successfully subscribed to donation notifications!'
        });

    } catch (error) {
        console.error('Notification subscription error:', error);
        res.status(500).json({ error: 'Failed to subscribe to notifications' });
    }
});

// Unsubscribe from notifications
app.post('/api/unsubscribe-notifications', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if subscribed
        const existingSubscription = await redisClient.hGet('notifications:subscribers', email);
        if (!existingSubscription) {
            return res.status(404).json({ error: 'Email not found in subscribers list' });
        }

        // Remove from notification subscribers
        await redisClient.hDel('notifications:subscribers', email);
        await redisClient.sRem('notifications:active_emails', email);

        console.log(`Unsubscribed from notifications: ${email}`);

        res.status(200).json({
            message: 'Successfully unsubscribed from donation notifications'
        });

    } catch (error) {
        console.error('Notification unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe from notifications' });
    }
});

// Unsubscribe page (GET request with email parameter)
app.get('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (email) {
            // Auto-unsubscribe if email is provided
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(email)) {
                await redisClient.hDel('notifications:subscribers', email);
                await redisClient.sRem('notifications:active_emails', email);
                console.log(`Auto-unsubscribed from notifications: ${email}`);
            }
        }

        // Serve unsubscribe page
        const unsubscribeHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscribe - Fast Help</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
                    .container { max-width: 500px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center; }
                    h1 { color: #1f2937; margin-bottom: 20px; }
                    p { color: #6b7280; line-height: 1.6; margin-bottom: 20px; }
                    .success { color: #059669; background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; }
                    .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; display: inline-block; margin: 10px; }
                    .btn:hover { transform: translateY(-2px); }
                    .form-group { margin: 20px 0; text-align: left; }
                    label { display: block; margin-bottom: 5px; font-weight: 600; color: #374151; }
                    input { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; }
                    input:focus { outline: none; border-color: #667eea; }
                    button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; cursor: pointer; width: 100%; font-size: 16px; }
                    button:hover { transform: translateY(-2px); }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📧 Unsubscribe from Notifications</h1>
                    ${email ? `<div class="success">✅ You have been successfully unsubscribed from donation notifications.</div>` : ''}
                    <p>We're sorry to see you go! You can unsubscribe from Fast Help donation notifications using the form below.</p>
                    
                    <form id="unsubscribe-form" onsubmit="unsubscribe(event)">
                        <div class="form-group">
                            <label for="email">Email Address</label>
                            <input type="email" id="email" name="email" value="${email || ''}" required>
                        </div>
                        <button type="submit">Unsubscribe</button>
                    </form>
                    
                    <div id="result" style="margin-top: 20px;"></div>
                    
                    <p style="margin-top: 30px;">
                        <a href="/" class="btn">🏠 Back to Fast Help</a>
                    </p>
                    
                    <p style="font-size: 14px; color: #9ca3af; margin-top: 30px;">
                        We respect your privacy. You can always resubscribe later if you change your mind.
                    </p>
                </div>
                
                <script>
                    async function unsubscribe(event) {
                        event.preventDefault();
                        const email = document.getElementById('email').value;
                        const resultDiv = document.getElementById('result');
                        
                        try {
                            const response = await fetch('/api/unsubscribe-notifications', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email })
                            });
                            
                            const data = await response.json();
                            
                            if (response.ok) {
                                resultDiv.innerHTML = '<div class="success">✅ ' + data.message + '</div>';
                            } else {
                                resultDiv.innerHTML = '<div style="color: #dc2626; background: #fee2e2; padding: 15px; border-radius: 8px;">❌ ' + data.error + '</div>';
                            }
                        } catch (error) {
                            resultDiv.innerHTML = '<div style="color: #dc2626; background: #fee2e2; padding: 15px; border-radius: 8px;">❌ Failed to unsubscribe. Please try again.</div>';
                        }
                    }
                </script>
            </body>
            </html>
        `;
        
        res.send(unsubscribeHtml);
        
    } catch (error) {
        console.error('Unsubscribe page error:', error);
        res.status(500).send('Error loading unsubscribe page');
    }
});

// Get donations
app.get('/api/donations', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        
        // Default to Austin center if no location provided
        const searchLat = lat ? parseFloat(lat) : 30.2672;
        const searchLng = lng ? parseFloat(lng) : -97.7431;
        const searchRadius = radius ? parseInt(radius) * 1.60934 : 16.09; // Convert miles to km, default 10 miles
        
        const donations = await RedisHelper.getAvailableDonations(
            searchLat,
            searchLng,
            searchRadius
        );

        // Filter to only Austin area donations
        const austinDonations = donations.filter(donation => 
            isWithinAustin(parseFloat(donation.lat), parseFloat(donation.lng))
        );

        res.json(austinDonations);

    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Create donation
app.post('/api/donations', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, description, type, address, lat, lng, dropoffInstructions } = req.body;
        
        if (!title || !description || !type || !lat || !lng) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate Austin coordinates
        if (!isWithinAustin(parseFloat(lat), parseFloat(lng))) {
            return res.status(400).json({ error: 'Donation location must be within Austin, TX' });
        }

        const donationData = {
            title,
            description,
            type,
            address: address || '',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            dropoffInstructions: dropoffInstructions || '',
            image: req.file ? `/uploads/${req.file.filename}` : null,
            donorId: req.user.userId,
            status: 'pending' // Require admin approval
        };

        const donation = await RedisHelper.createDonation(donationData);

        res.status(201).json({
            message: 'Donation submitted successfully and is pending admin approval',
            donationId: donation._id
        });

    } catch (error) {
        console.error('Error creating donation:', error);
        res.status(500).json({ error: 'Failed to create donation' });
    }
});

// Mark donation as picked up
app.post('/api/donations/:id/pickup', async (req, res) => {
    try {
        const { id } = req.params;
        const { pickerName, pickerEmail, pickerPhone } = req.body;

        if (!pickerName || !pickerEmail) {
            return res.status(400).json({ error: 'Picker name and email are required' });
        }

        const donation = await RedisHelper.getDonationById(id);
        
        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        if (donation.status !== 'available') {
            return res.status(400).json({ error: 'Donation is no longer available' });
        }

        // Update donation status
        const pickupData = {
            pickerName,
            pickerEmail,
            pickerPhone: pickerPhone || '',
            pickedUpAt: new Date().toISOString()
        };

        await RedisHelper.updateDonationStatus(id, 'picked_up', { pickup: JSON.stringify(pickupData) });

        // Create pickup tracking record
        const trackingData = {
            donationId: id,
            pickerName,
            pickerEmail,
            pickerPhone: pickerPhone || '',
            pickedUpAt: new Date().toISOString(),
            status: 'picked_up',
            deliveryStatus: 'pending_delivery'
        };

        const tracking = await RedisHelper.createPickup(trackingData);

        // Send confirmation email to picker
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const confirmationHtml = await EmailTemplateHelper.sendPickupConfirmation(donation, pickerName, tracking._id, baseUrl);
        
        if (confirmationHtml) {
            await sendEmail(pickerEmail, '🎉 Pickup Confirmed - You\'re Making a Difference!', confirmationHtml);
        }

        res.json({
            message: 'Pickup confirmed successfully! Thank you for helping your Austin community. Please confirm delivery location to complete the process.',
            trackingId: tracking._id,
            encouragement: 'Your kindness is making Austin more caring - one delivery at a time! 💝'
        });

    } catch (error) {
        console.error('Error confirming pickup:', error);
        res.status(500).json({ error: 'Failed to confirm pickup' });
    }
});

// Delivery confirmation
app.post('/api/delivery-confirmation/:trackingId', upload.single('deliveryImage'), async (req, res) => {
    try {
        const { trackingId } = req.params;
        const { deliveryLocation, deliveryNotes, deliveredTo } = req.body;

        const pickup = await RedisHelper.getPickupById(trackingId);
        
        if (!pickup) {
            return res.status(404).json({ error: 'Tracking record not found' });
        }

        const deliveryConfirmation = {
            deliveryLocation,
            deliveryNotes: deliveryNotes || '',
            deliveredTo: deliveredTo || '',
            deliveryImage: req.file ? `/uploads/${req.file.filename}` : null,
            deliveredAt: new Date().toISOString()
        };

        await RedisHelper.updatePickup(trackingId, {
            deliveryStatus: 'delivered',
            deliveryConfirmation: JSON.stringify(deliveryConfirmation)
        });

        // Send thank you email
        const thankYouHtml = await EmailTemplateHelper.sendDeliveryThankYou(
            pickup.pickerName, 
            deliveryLocation, 
            deliveredTo, 
            deliveryNotes
        );
        
        if (thankYouHtml) {
            await sendEmail(picker.pickerEmail, 'Thank You for Your Delivery - Fast Help', thankYouHtml);
        }

        res.json({
            message: 'Delivery confirmed successfully'
        });

    } catch (error) {
        console.error('Error confirming delivery:', error);
        res.status(500).json({ error: 'Failed to confirm delivery' });
    }
});

// Get user's own donations
app.get('/api/donations/my', authenticateToken, async (req, res) => {
    try {
        const allDonations = await RedisHelper.getAllDonations();
        const userDonations = allDonations.filter(donation => donation.donorId === req.user.userId);
        
        res.json(userDonations);
    } catch (error) {
        console.error('Error fetching user donations:', error);
        res.status(500).json({ error: 'Failed to fetch your donations' });
    }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await RedisHelper.getUserById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Failed to fetch user information' });
    }
});

// Admin routes
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const users = await RedisHelper.getAllUsers();
        
        // Remove passwords from response
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json(usersWithoutPasswords);

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Approve user
app.post('/api/admin/users/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const user = await RedisHelper.getUserById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await RedisHelper.approveUser(id);

        // Send approval email
        const loginUrl = `${req.protocol}://${req.get('host')}/donor-signup`;
        const approvalHtml = await EmailTemplateHelper.sendAccountApproval(user.fullName, loginUrl);
        
        if (approvalHtml) {
            await sendEmail(user.email, 'Account Approved - Fast Help', approvalHtml);
        }

        res.json({ message: 'User approved successfully' });

    } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Deny user
app.post('/api/admin/users/:id/deny', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const user = await RedisHelper.getUserById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await RedisHelper.updateUser(id, { isApproved: 'denied' });

        res.json({ message: 'User denied successfully' });

    } catch (error) {
        console.error('Error denying user:', error);
        res.status(500).json({ error: 'Failed to deny user' });
    }
});

// Delete user
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const user = await RedisHelper.getUserById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow deleting other admins
        if (user.role === 'admin' && user._id !== req.user.userId) {
            return res.status(403).json({ error: 'Cannot delete other admin users' });
        }

        await RedisHelper.deleteUser(id);

        res.json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Admin donation management endpoints
app.get('/api/admin/donations', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const donations = await RedisHelper.getAllDonations();
        res.json(donations);

    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Approve donation
app.post('/api/admin/donations/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const donation = await RedisHelper.getDonationById(id);

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        await RedisHelper.updateDonation(id, { 
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: req.user.userId
        });

        // Add to available donations and geo index
        await redisClient.sAdd('donations:available', id);
        
        const approvedDonation = await RedisHelper.getDonationById(id);
        if (approvedDonation && approvedDonation.lat && approvedDonation.lng) {
            await redisClient.geoAdd('donations:geo', {
                longitude: parseFloat(approvedDonation.lng),
                latitude: parseFloat(approvedDonation.lat),
                member: id
            });
        }

        // Send notification emails to subscribers
        await sendDonationNotificationEmails(approvedDonation);

        res.json({ message: 'Donation approved successfully' });

    } catch (error) {
        console.error('Error approving donation:', error);
        res.status(500).json({ error: 'Failed to approve donation' });
    }
});

// Deny donation
app.post('/api/admin/donations/:id/deny', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const donation = await RedisHelper.getDonationById(id);

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        await RedisHelper.updateDonation(id, { 
            status: 'denied',
            deniedAt: new Date().toISOString(),
            deniedBy: req.user.userId
        });

        res.json({ message: 'Donation denied successfully' });

    } catch (error) {
        console.error('Error denying donation:', error);
        res.status(500).json({ error: 'Failed to deny donation' });
    }
});

// Delete donation
app.delete('/api/admin/donations/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const donation = await RedisHelper.getDonationById(id);

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        await RedisHelper.deleteDonation(id);

        res.json({ message: 'Donation deleted successfully' });

    } catch (error) {
        console.error('Error deleting donation:', error);
        res.status(500).json({ error: 'Failed to delete donation' });
    }
});

// Admin stats endpoint
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get basic stats (simplified for demo)
        const users = await RedisHelper.getAllUsers() || [];
        const donations = await RedisHelper.getAllDonations() || [];
        
        const stats = {
            totalUsers: users.length,
            totalDonations: donations.length,
            activeDonors: users.filter(u => u.userType === 'donor' && u.status === 'active').length,
            pendingRequests: donations.filter(d => d.status === 'pending').length
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Catch-all handler for React Router (must be LAST route)
if (NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        console.log(`🔄 React Router fallback for: ${req.path}`);
        res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
    });
}

// Additional Routes (root route already defined at top)
app.get('/donor-signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'donor-signup.html'));
});

app.get('/donor-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'donor-dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/delivery-confirmation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'delivery-confirmation.html'));
});

// 404 handler - must be last
app.get('*', (req, res) => {
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ 
            error: 'API endpoint not found',
            path: req.path,
            method: req.method 
        });
    } else {
        // Serve 404 page for web requests
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// Create default admin user on first run
async function createDefaultAdmin() {
    try {
        // Skip if Redis is not available
        if (!redisClient || !redisClient.isReady) {
            log('info', 'Skipping admin creation - Redis not available');
            return;
        }
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@fasthelp.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        const adminExists = await RedisHelper.getUserByEmail(adminEmail);
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash(adminPassword, 12);
            
            const adminData = {
                fullName: 'Admin User',
                username: 'admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                isApproved: true // This will be converted to string in createUser method
            };

            await RedisHelper.createUser(adminData);
            log('info', `Default admin user created: ${adminEmail}`);
            
            if (adminPassword === 'admin123') {
                log('warn', '⚠️  WARNING: Using default admin password. Please change it immediately after deployment!');
            }
        }
    } catch (error) {
        log('error', 'Error creating default admin - continuing without admin user', { error: error.message });
    }
}

// Start server - bind to all interfaces for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ===== RAILWAY DEPLOYMENT SUCCESS =====`);
    console.log(`✅ SERVER STARTED ON ALL INTERFACES (0.0.0.0:${PORT})`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`🚀 ===== READY FOR RAILWAY TRAFFIC =====`);
    
    log('info', `Fast Help server running on port ${PORT}`, {
        port: PORT,
        environment: NODE_ENV,
        healthCheck: `http://0.0.0.0:${PORT}/health`,
        timestamp: new Date().toISOString()
    });
    
    // Log successful server start
    console.log(`✅ SERVER STARTED SUCCESSFULLY ON PORT ${PORT}`);
    console.log(`✅ Health check available at: http://0.0.0.0:${PORT}/health`);
    console.log(`✅ Status page available at: http://0.0.0.0:${PORT}/status`);
    
    // Create default admin after server starts and Redis is connected
    setTimeout(createDefaultAdmin, 3000);
    
    // Verify server is actually responding
    setTimeout(() => {
        console.log(`🔍 SERVER HEALTH CHECK: Listening on ${PORT}`);
        console.log(`🔍 RAILWAY: Server should be responding to health checks now`);
    }, 1000);
});

// Handle server startup errors
server.on('error', (err) => {
    log('error', 'Server failed to start', { error: err.message, port: PORT });
    console.error(`❌ SERVER FAILED TO START ON PORT ${PORT}:`, err.message);
    
    // Don't exit immediately - Railway might retry
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${PORT} is in use - Railway will handle this`);
    } else {
        console.log(`⚠️ Server error: ${err.message} - Railway will handle restart`);
    }
});

// Handle process termination gracefully
process.on('SIGINT', () => {
    log('info', 'Shutting down server gracefully...');
    if (redisClient && redisClient.isReady) {
        redisClient.quit();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('info', 'Shutting down server gracefully...');
    if (redisClient && redisClient.isReady) {
        redisClient.quit();
    }
    process.exit(0);
});
