const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
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

// MongoDB connection
const MONGODB_URI = 'mongodb://mongo:PrCmSSaYhmrWQURqKPojYynHjNYzdRbx@shuttle.proxy.rlwy.net:12958/fasthelp';
let db;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI, { useUnifiedTopology: true })
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db('fasthelp');
        
        // Create indexes
        db.collection('users').createIndex({ email: 1 }, { unique: true });
        db.collection('users').createIndex({ username: 1 }, { unique: true });
        db.collection('donations').createIndex({ location: '2dsphere' });
        db.collection('donations').createIndex({ createdAt: -1 });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

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

// Function to get email configuration from database
async function getEmailConfig() {
    try {
        const config = await db.collection('settings').findOne({ type: 'email' });
        if (config && config.smtp) {
            emailTransporter = nodemailer.createTransporter(config.smtp);
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
        const existingUser = await db.collection('users').findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = {
            fullName,
            username,
            email,
            phone: phone || '',
            password: hashedPassword,
            role: 'donor',
            isApproved: false, // Requires admin approval
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('users').insertOne(user);

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
            userId: result.insertedId
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
        const user = await db.collection('users').findOne({ email });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user is approved
        if (!user.isApproved) {
            return res.status(401).json({ error: 'Your account is pending approval' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Update last login
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );

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
        
        let query = { status: 'available' };
        
        // If location provided, find nearby donations
        if (lat && lng) {
            const radiusInMeters = radius ? parseInt(radius) * 1000 : 10000; // Default 10km
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: radiusInMeters
                }
            };
        }

        const donations = await db.collection('donations')
            .find(query)
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

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

        const donation = {
            title,
            description,
            type,
            address: address || '',
            location: {
                type: 'Point',
                coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            dropoffInstructions: dropoffInstructions || '',
            image: req.file ? `/uploads/${req.file.filename}` : null,
            donorId: new ObjectId(req.user.userId),
            status: 'available',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('donations').insertOne(donation);

        res.status(201).json({
            message: 'Donation posted successfully',
            donationId: result.insertedId
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

        const donation = await db.collection('donations').findOne({ _id: new ObjectId(id) });
        
        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        if (donation.status !== 'available') {
            return res.status(400).json({ error: 'Donation is no longer available' });
        }

        // Update donation status
        const pickup = {
            pickerName,
            pickerEmail,
            pickerPhone: pickerPhone || '',
            pickedUpAt: new Date(),
            status: 'picked_up'
        };

        await db.collection('donations').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    status: 'picked_up',
                    pickup,
                    updatedAt: new Date()
                }
            }
        );

        // Create pickup tracking record
        const tracking = {
            donationId: new ObjectId(id),
            pickerName,
            pickerEmail,
            pickerPhone: pickerPhone || '',
            pickedUpAt: new Date(),
            status: 'picked_up',
            deliveryStatus: 'pending_delivery'
        };

        const trackingResult = await db.collection('pickups').insertOne(tracking);

        // Send confirmation email to picker
        const confirmationHtml = `
            <h2>Pickup Confirmation - Fast Help</h2>
            <p>Dear ${pickerName},</p>
            <p>Thank you for picking up the donation: <strong>${donation.title}</strong></p>
            <p>We hope this helps someone in need!</p>
            <p>Please click the link below to confirm where you delivered this item:</p>
            <p><a href="${req.protocol}://${req.get('host')}/delivery-confirmation?tracking=${trackingResult.insertedId}" 
               style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
               Confirm Delivery Location</a></p>
            <br>
            <p>Best regards,<br>The Fast Help Team</p>
        `;

        await sendEmail(pickerEmail, 'Pickup Confirmation - Fast Help', confirmationHtml);

        res.json({
            message: 'Pickup confirmed successfully',
            trackingId: trackingResult.insertedId
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

        const pickup = await db.collection('pickups').findOne({ _id: new ObjectId(trackingId) });
        
        if (!pickup) {
            return res.status(404).json({ error: 'Tracking record not found' });
        }

        const deliveryConfirmation = {
            deliveryLocation,
            deliveryNotes: deliveryNotes || '',
            deliveredTo: deliveredTo || '',
            deliveryImage: req.file ? `/uploads/${req.file.filename}` : null,
            deliveredAt: new Date()
        };

        await db.collection('pickups').updateOne(
            { _id: new ObjectId(trackingId) },
            { 
                $set: { 
                    deliveryStatus: 'delivered',
                    deliveryConfirmation,
                    updatedAt: new Date()
                }
            }
        );

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

        const users = await db.collection('users')
            .find({}, { projection: { password: 0 } })
            .sort({ createdAt: -1 })
            .toArray();

        res.json(users);

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
        const user = await db.collection('users').findOne({ _id: new ObjectId(id) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(id) },
            { $set: { isApproved: true, updatedAt: new Date() } }
        );

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

        const settings = await db.collection('settings').findOne({ type: 'email' });
        
        if (settings) {
            // Remove sensitive password from response
            const { smtp, ...other } = settings;
            const { pass, ...smtpWithoutPass } = smtp;
            res.json({ ...other, smtp: { ...smtpWithoutPass, pass: '••••••••' } });
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

        const settings = {
            type: 'email',
            smtp: smtpConfig,
            from,
            updatedAt: new Date()
        };

        await db.collection('settings').replaceOne(
            { type: 'email' },
            settings,
            { upsert: true }
        );

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

        const [
            totalUsers,
            pendingUsers,
            totalDonations,
            availableDonations,
            pickedUpDonations,
            totalPickups
        ] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('users').countDocuments({ isApproved: false }),
            db.collection('donations').countDocuments(),
            db.collection('donations').countDocuments({ status: 'available' }),
            db.collection('donations').countDocuments({ status: 'picked_up' }),
            db.collection('pickups').countDocuments()
        ]);

        res.json({
            totalUsers,
            pendingUsers,
            totalDonations,
            availableDonations,
            pickedUpDonations,
            totalPickups
        });

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
        const adminExists = await db.collection('users').findOne({ role: 'admin' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            
            const admin = {
                fullName: 'Admin User',
                username: 'admin',
                email: 'admin@fasthelp.com',
                password: hashedPassword,
                role: 'admin',
                isApproved: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await db.collection('users').insertOne(admin);
            console.log('Default admin user created: admin@fasthelp.com / admin123');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Fast Help server running on http://localhost:${PORT}`);
    
    // Create default admin after server starts
    setTimeout(createDefaultAdmin, 2000);
});
