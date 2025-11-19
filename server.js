const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Database connection
let db;
async function connectDB() {
    try {
        if (process.env.NODE_ENV === 'production') {
            console.log('🔗 Connecting to Railway MySQL database...');
            
            // Method 1: Use DATABASE_URL if available (Render + Railway)
            if (process.env.DATABASE_URL) {
                db = await mysql.createConnection(process.env.DATABASE_URL);
                console.log('✅ Connected via DATABASE_URL');
            }
            // Method 2: Use Railway's default environment variables
            else if (process.env.MYSQLHOST) {
                db = await mysql.createConnection({
                    host: process.env.MYSQLHOST,
                    user: process.env.MYSQLUSER,
                    password: process.env.MYSQLPASSWORD,
                    database: process.env.MYSQLDATABASE,
                    port: process.env.MYSQLPORT,
                    ssl: { rejectUnauthorized: false }
                });
                console.log('✅ Connected via Railway default variables');
            }
            // Method 3: Use custom environment variables
            else if (process.env.DB_HOST) {
                db = await mysql.createConnection({
                    host: process.env.DB_HOST,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    database: process.env.DB_NAME,
                    port: process.env.DB_PORT || 3306,
                    ssl: { rejectUnauthorized: false }
                });
                console.log('✅ Connected via custom environment variables');
            }
            // Method 4: Use connection string from custom variable
            else if (process.env.MYSQL_interiordesign) {
                db = await mysql.createConnection(process.env.MYSQL_interiordesign);
                console.log('✅ Connected via MYSQL_interiordesign variable');
            }
            else {
                throw new Error('No database configuration found for production environment');
            }
        } else {
            // Development database (Laragon MySQL)
            console.log('🔗 Connecting to local MySQL database...');
            db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'pure_pleasure_db',
                port: process.env.DB_PORT || 3306
            });
            console.log('✅ Connected to local database');
        }
        
        // Initialize database tables
        await initDB();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('💡 Check your environment variables:');
        console.log('   - DATABASE_URL (for connection string)');
        console.log('   - MYSQLHOST, MYSQLUSER, MYSQLPASSWORD (Railway default)');
        console.log('   - DB_HOST, DB_USER, DB_PASSWORD (custom)');
        console.log('   - MYSQL_interiordesign (custom connection string)');
        process.exit(1);
    }
}

// Initialize database tables
async function initDB() {
    try {
        // Create designs table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS designs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                image VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create admin table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS admin (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Check if admin user exists, if not create one
        const [rows] = await db.execute('SELECT * FROM admin WHERE username = ?', ['admin']);
        if (rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.execute('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
            console.log('👤 Default admin user created: admin / admin123');
        }
        
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
    }
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: db ? 'connected' : 'disconnected'
    });
});

// Get all designs
app.get('/api/designs', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM designs ORDER BY created_at DESC');
        res.json({ success: true, designs: rows });
    } catch (error) {
        console.error('Error fetching designs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch designs' });
    }
});

// Get single design
app.get('/api/designs/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM designs WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Design not found' });
        }
        res.json({ success: true, design: rows[0] });
    } catch (error) {
        console.error('Error fetching design:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch design' });
    }
});

// Create new design (Admin only)
app.post('/api/designs', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, description } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ success: false, message: 'Title and description are required' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Image file is required' });
        }
        
        const image = req.file.filename;
        
        const [result] = await db.execute(
            'INSERT INTO designs (title, image, description) VALUES (?, ?, ?)',
            [title, image, description]
        );
        
        res.json({ success: true, message: 'Design created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating design:', error);
        res.status(500).json({ success: false, message: 'Failed to create design' });
    }
});

// Update design (Admin only)
app.post('/api/designs/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, description } = req.body;
        const designId = req.params.id;
        
        if (!title || !description) {
            return res.status(400).json({ success: false, message: 'Title and description are required' });
        }
        
        let image;
        if (req.file) {
            // New image uploaded
            image = req.file.filename;
            
            // Get old image filename to delete it
            const [oldRows] = await db.execute('SELECT image FROM designs WHERE id = ?', [designId]);
            if (oldRows.length > 0) {
                const oldImage = oldRows[0].image;
                const oldImagePath = path.join(uploadsDir, oldImage);
                
                // Delete old image file
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    console.log(`🗑️  Deleted old image: ${oldImage}`);
                }
            }
            
            const [result] = await db.execute(
                'UPDATE designs SET title = ?, image = ?, description = ? WHERE id = ?',
                [title, image, description, designId]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Design not found' });
            }
        } else {
            // No new image, update only title and description
            const [result] = await db.execute(
                'UPDATE designs SET title = ?, description = ? WHERE id = ?',
                [title, description, designId]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Design not found' });
            }
        }
        
        res.json({ success: true, message: 'Design updated successfully' });
    } catch (error) {
        console.error('Error updating design:', error);
        res.status(500).json({ success: false, message: 'Failed to update design' });
    }
});

// Delete design (Admin only)
app.delete('/api/designs/:id', authenticateToken, async (req, res) => {
    try {
        const designId = req.params.id;
        
        // Get image filename before deleting
        const [rows] = await db.execute('SELECT image FROM designs WHERE id = ?', [designId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Design not found' });
        }
        
        const image = rows[0].image;
        const imagePath = path.join(uploadsDir, image);
        
        // Delete from database
        const [result] = await db.execute('DELETE FROM designs WHERE id = ?', [designId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Design not found' });
        }
        
        // Delete image file
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️  Deleted image file: ${image}`);
        }
        
        res.json({ success: true, message: 'Design deleted successfully' });
    } catch (error) {
        console.error('Error deleting design:', error);
        res.status(500).json({ success: false, message: 'Failed to delete design' });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }
        
        const [rows] = await db.execute('SELECT * FROM admin WHERE username = ?', [username]);
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const admin = rows[0];
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ success: true, message: 'Login successful', token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Verify admin token
app.get('/api/admin/verify', authenticateToken, (req, res) => {
    res.json({ success: true, message: 'Token is valid', user: req.user });
});

// Error handling for file uploads
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
        }
    }
    res.status(500).json({ success: false, message: error.message });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Start server
async function startServer() {
    await connectDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📁 Uploads directory: ${uploadsDir}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        console.log(`👤 Default admin: admin / admin123`);
        console.log('\n📋 Supported database connection methods:');
        console.log('   1. DATABASE_URL (connection string)');
        console.log('   2. MYSQLHOST, MYSQLUSER, MYSQLPASSWORD (Railway default)');
        console.log('   3. DB_HOST, DB_USER, DB_PASSWORD (custom)');
        console.log('   4. MYSQL_interiordesign (custom connection string)');
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    if (db) {
        await db.end();
        console.log('✅ Database connection closed');
    }
    process.exit(0);
});

startServer().catch(console.error);