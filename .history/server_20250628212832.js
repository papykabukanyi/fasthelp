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

// Get user's donations
app.get('/api/my-donations', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM donations WHERE donor_id = ? ORDER BY created_at DESC',
    [req.user.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch donations' });
      }
      res.json(rows);
    }
  );
});

// Update donation status
app.put('/api/donations/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const donationId = req.params.id;

  db.run(
    'UPDATE donations SET status = ? WHERE uuid = ? AND donor_id = ?',
    [status, donationId, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update donation' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Donation not found' });
      }
      res.json({ message: 'Donation status updated successfully' });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Fast Help server running on http://localhost:${PORT}`);
});
