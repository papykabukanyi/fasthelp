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
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://default:jruEbHscCcZMsxpoOcYwuOmlLAdDwmOs@nozomi.proxy.rlwy.net:34022';
let redisClient;

// Connect to Redis
async function connectRedis() {
    try {
        redisClient = redis.createClient({
            url: REDIS_URL,
            socket: {
                tls: false, // Set to true if using SSL
                rejectUnauthorized: false
            }
        });

        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
            console.log('Connected to Redis successfully');
        });

        await redisClient.connect();
        console.log('Redis connection established');
    } catch (err) {
        console.error('Redis connection error:', err);
        process.exit(1);
    }
}

// Initialize Redis connection
connectRedis();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'fasthelp-secret-key-change-in-production';

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
    // Users
    static async createUser(userData) {
        const userId = uuidv4();
        const user = {
            id: userId,
            ...userData,
            isApproved: userData.isApproved ? 'true' : 'false', // Convert boolean to string
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Convert all values to strings for Redis
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
    }
    
    static async getUserById(userId) {
        const user = await redisClient.hGetAll(`user:${userId}`);
        return Object.keys(user).length ? { ...user, _id: userId } : null;
    }
    
    static async getUserByEmail(email) {
        const userId = await redisClient.hGet('users:email', email);
        return userId ? await this.getUserById(userId) : null;
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
        await redisClient.sAdd('donations:available', donationId);
        
        // Add to geospatial index for location-based queries
        if (donation.lat && donation.lng) {
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
        
        return {
            totalUsers,
            pendingUsers,
            totalDonations,
            availableDonations,
            pickedUpDonations,
            totalPickups
        };
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
        const welcomeHtml = `
            <h2>Welcome to Fast Help!</h2>
            <p>Dear ${fullName},</p>
            <p>Thank you for signing up as a donor on Fast Help. Your account is currently pending approval.</p>
            <p>Once approved, you'll be able to post donations and help people in need in your community.</p>
            <p>We'll notify you once your account is approved.</p>
            <br>
            <p>Best regards,<br>The Fast Help Team</p>
        `;
        
        await sendEmail(email, 'Welcome to Fast Help - Account Pending Approval', welcomeHtml);

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

        // Check if user is approved
        if (user.isApproved !== 'true') {
            return res.status(401).json({ error: 'Your account is pending approval' });
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

// Get donations
app.get('/api/donations', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        
        const donations = await RedisHelper.getAvailableDonations(
            lat ? parseFloat(lat) : null,
            lng ? parseFloat(lng) : null,
            radius ? parseInt(radius) : 10
        );

        res.json(donations);

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
            status: 'available'
        };

        const donation = await RedisHelper.createDonation(donationData);

        res.status(201).json({
            message: 'Donation posted successfully',
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
        const confirmationHtml = `
            <h2>Pickup Confirmation - Fast Help</h2>
            <p>Dear ${pickerName},</p>
            <p>Thank you for picking up the donation: <strong>${donation.title}</strong></p>
            <p>We hope this helps someone in need!</p>
            <p>Please click the link below to confirm where you delivered this item:</p>
            <p><a href="${req.protocol}://${req.get('host')}/delivery-confirmation?tracking=${tracking._id}" 
               style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
               Confirm Delivery Location</a></p>
            <br>
            <p>Best regards,<br>The Fast Help Team</p>
        `;

        await sendEmail(pickerEmail, 'Pickup Confirmation - Fast Help', confirmationHtml);

        res.json({
            message: 'Pickup confirmed successfully',
            trackingId: tracking._id
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
        const thankYouHtml = `
            <h2>Thank You for Your Kindness!</h2>
            <p>Dear ${pickup.pickerName},</p>
            <p>Thank you for confirming the delivery of the donated item.</p>
            <p><strong>Delivery Details:</strong></p>
            <ul>
                <li>Location: ${deliveryLocation}</li>
                ${deliveredTo ? `<li>Delivered to: ${deliveredTo}</li>` : ''}
                ${deliveryNotes ? `<li>Notes: ${deliveryNotes}</li>` : ''}
            </ul>
            <p>Your kindness makes a real difference in someone's life!</p>
            <br>
            <p>Best regards,<br>The Fast Help Team</p>
        `;

        await sendEmail(pickup.pickerEmail, 'Thank You for Your Delivery - Fast Help', thankYouHtml);

        res.json({
            message: 'Delivery confirmed successfully'
        });

    } catch (error) {
        console.error('Error confirming delivery:', error);
        res.status(500).json({ error: 'Failed to confirm delivery' });
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
        const approvalHtml = `
            <h2>Account Approved - Fast Help</h2>
            <p>Dear ${user.fullName},</p>
            <p>Great news! Your Fast Help donor account has been approved.</p>
            <p>You can now log in and start posting donations to help people in need.</p>
            <p><a href="${req.protocol}://${req.get('host')}/donor-signup" 
               style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
               Log In Now</a></p>
            <br>
            <p>Thank you for joining our community of helpers!</p>
            <p>Best regards,<br>The Fast Help Team</p>
        `;

        await sendEmail(user.email, 'Account Approved - Fast Help', approvalHtml);

        res.json({ message: 'User approved successfully' });

    } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Get/Update email settings
app.get('/api/admin/email-settings', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const settings = await RedisHelper.getSetting('email');
        
        if (settings && settings.smtp) {
            // Remove sensitive password from response
            const smtpConfig = JSON.parse(settings.smtp);
            const { pass, ...smtpWithoutPass } = smtpConfig.auth || {};
            res.json({ 
                ...settings, 
                smtp: { 
                    ...smtpConfig, 
                    auth: { ...smtpWithoutPass, pass: '••••••••' } 
                } 
            });
        } else {
            res.json({ type: 'email', smtp: {} });
        }

    } catch (error) {
        console.error('Error fetching email settings:', error);
        res.status(500).json({ error: 'Failed to fetch email settings' });
    }
});

app.post('/api/admin/email-settings', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { host, port, secure, user, pass, from } = req.body;

        const smtpConfig = {
            host,
            port: parseInt(port),
            secure: secure === 'true',
            auth: {
                user,
                pass
            }
        };

        await RedisHelper.saveSetting('email', {
            smtp: JSON.stringify(smtpConfig),
            from
        });

        // Reset email transporter to use new settings
        emailTransporter = null;

        res.json({ message: 'Email settings saved successfully' });

    } catch (error) {
        console.error('Error saving email settings:', error);
        res.status(500).json({ error: 'Failed to save email settings' });
    }
});

// Admin dashboard stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const stats = await RedisHelper.getStats();
        res.json(stats);

    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Create default admin user on first run
async function createDefaultAdmin() {
    try {
        const adminExists = await RedisHelper.getUserByEmail('admin@fasthelp.com');
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            
            const adminData = {
                fullName: 'Admin User',
                username: 'admin',
                email: 'admin@fasthelp.com',
                password: hashedPassword,
                role: 'admin',
                isApproved: true // This will be converted to string in createUser method
            };

            await RedisHelper.createUser(adminData);
            console.log('Default admin user created: admin@fasthelp.com / admin123');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Fast Help server running on http://localhost:${PORT}`);
    
    // Create default admin after server starts and Redis is connected
    setTimeout(createDefaultAdmin, 3000);
});
