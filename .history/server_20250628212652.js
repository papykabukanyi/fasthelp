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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Initialize SQLite database
const db = new sqlite3.Database('fasthelp.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    phone TEXT,
    full_name TEXT,
    approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Donations table
  db.run(`CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    donor_id INTEGER,
    title TEXT,
    description TEXT,
    category TEXT,
    image_path TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users (id)
  )`);
});

// Middleware to verify JWT token
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

// Routes

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve donor signup page
app.get('/donor-signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'donor-signup.html'));
});

// Serve donor dashboard
app.get('/donor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'donor-dashboard.html'));
});

// API Routes

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, phone, fullName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userUuid = uuidv4();

    db.run(
      'INSERT INTO users (uuid, username, email, password, phone, full_name) VALUES (?, ?, ?, ?, ?, ?)',
      [userUuid, username, email, hashedPassword, phone, fullName],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        res.status(201).json({ 
          message: 'Registration successful. Please wait for approval.',
          userId: userUuid
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }

      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      if (!user.approved) {
        return res.status(400).json({ error: 'Account not yet approved' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, uuid: user.uuid, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.uuid,
          username: user.username,
          email: user.email,
          fullName: user.full_name
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available donations
app.get('/api/donations', (req, res) => {
  db.all(`
    SELECT d.*, u.username, u.full_name 
    FROM donations d 
    JOIN users u ON d.donor_id = u.id 
    WHERE d.status = 'available'
    ORDER BY d.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch donations' });
    }
    res.json(rows);
  });
});

// Create new donation
app.post('/api/donations', authenticateToken, upload.single('image'), (req, res) => {
  try {
    const { title, description, category, latitude, longitude, address } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : null;
    const donationUuid = uuidv4();

    db.run(
      'INSERT INTO donations (uuid, donor_id, title, description, category, image_path, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [donationUuid, req.user.userId, title, description, category, imagePath, latitude, longitude, address],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create donation' });
        }
        res.status(201).json({ 
          message: 'Donation created successfully',
          donationId: donationUuid
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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
