const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================= CORS CONFIG =========================

// Allowed specific frontend origins
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',

    // Render frontend URLs
    'https://interior-design-1-tie5.onrender.com',
    'https://pure-pleasure-frontend.onrender.com'
];

// Main middleware
app.use(cors({
    origin: function (origin, callback) {
    // Allow non-browser requests (Postman, mobile apps, curl)
    if (!origin) return callback(null, true);

    // Allow ALL *.onrender.com subdomains
    if (origin.endsWith('.onrender.com')) {
        console.log(`✅ Allowed Render origin: ${origin}`);
        return callback(null, true);
        }

        // Allow ALL *.vercel.app subdomains
        if (origin.endsWith('.vercel.app')) {
        console.log(`✅ Allowed Vercel origin: ${origin}`);
        return callback(null, true);
    }

    // Check specific allowed origins list
    if (!allowedOrigins.includes(origin)) {
        console.log(`🚫 CORS BLOCKED: ${origin}`);
        const msg = 'CORS blocked: Origin not allowed.';
        return callback(new Error(msg), false);
        }

        console.log(`✅ Allowed origin: ${origin}`);
        return callback(null, true);
    },

    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve uploaded files statically - with production path handling
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    
    // Catch-all handler for SPA
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
    });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
const videosDir = path.join(__dirname, 'uploads/videos');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
    console.log('Created videos directory');
}

// Configure multer for image uploads
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

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/videos/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const videoUpload = multer({
    storage: videoStorage,
    fileFilter: (req, file, cb) => {
        // Check if file is a video
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit for videos
    }
});

// YouTube configuration
const youtube = google.youtube('v3');

// YouTube authentication using web flow
function getYouTubeAuth() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback'
    );

    // Set credentials from environment variables
    oauth2Client.setCredentials({
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
    });

    return oauth2Client;
}

// Function to upload video to YouTube
async function uploadToYouTube(videoPath, title, description) {
    try {
        console.log('🚀 Starting YouTube upload...');
        const auth = getYouTubeAuth();
        
        const response = await youtube.videos.insert({
            auth: auth,
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: title,
                    description: description + '\n\nFor more interior design ideas, visit our website.',
                    tags: ['interior design', 'building', 'construction', 'design ideas', 'home decor'],
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(videoPath)
            }
        });

        console.log('✅ Video uploaded to YouTube:', response.data.id);
        return response.data;
    } catch (error) {
        console.error('❌ YouTube upload error:', error.message);
        if (error.errors) {
            error.errors.forEach(err => {
                console.error('  -', err.message);
            });
        }
        throw error;
    }
}

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
            console.log('🔗 Connecting to local MySQL database...');
            const host = process.env.DB_HOST || 'localhost';
            const user = process.env.DB_USER || 'root';
            const password = process.env.DB_PASSWORD || '';
            const database = process.env.DB_NAME || 'pure_pleasure_db';
            const port = process.env.DB_PORT || 3306;
            try {
                db = await mysql.createConnection({ host, user, password, database, port });
            } catch (err) {
                if (err && err.code === 'ER_BAD_DB_ERROR') {
                    const tmp = await mysql.createConnection({ host, user, password, port });
                    await tmp.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
                    await tmp.end();
                    db = await mysql.createConnection({ host, user, password, database, port });
                } else {
                    throw err;
                }
            }
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
        
        // Create videos table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS videos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                video_file VARCHAR(255) NOT NULL,
                youtube_url VARCHAR(500),
                youtube_video_id VARCHAR(100),
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
const JWT_SECRET = process.env.JWT_SECRET || 'sxjscjsbfdbffbjdfdfbfw343439wdwnmwd822ne28ndndndn';

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
        database: db ? 'connected' : 'disconnected',
        cors: {
            allowedOrigins: allowedOrigins,
            currentOrigin: req.headers.origin || 'No origin header'
        }
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

// Video Routes

// Upload video (Admin only)
app.post('/api/videos', authenticateToken, videoUpload.single('video'), async (req, res) => {
    try {
        const { title, description, uploadToYoutube } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ success: false, message: 'Title and description are required' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Video file is required' });
        }
        
        const videoFile = req.file.filename;
        let youtubeUrl = null;
        let youtubeVideoId = null;

        // Upload to YouTube if requested
        if (uploadToYoutube === 'true') {
            try {
                console.log('🎬 Starting YouTube upload process...');
                const videoPath = path.join(__dirname, 'uploads/videos', videoFile);
                
                const youtubeResponse = await uploadToYouTube(
                    videoPath, 
                    title, 
                    description
                );
                
                youtubeVideoId = youtubeResponse.id;
                youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
                
                console.log('✅ Video successfully uploaded to YouTube:', youtubeUrl);
            } catch (youtubeError) {
                console.error('❌ Failed to upload to YouTube:', youtubeError.message);
                // Continue with database save even if YouTube upload fails
            }
        }

        // Save to database
        const [result] = await db.execute(
            'INSERT INTO videos (title, video_file, youtube_url, youtube_video_id, description) VALUES (?, ?, ?, ?, ?)',
            [title, videoFile, youtubeUrl, youtubeVideoId, description]
        );
        
        res.json({ 
            success: true, 
            message: 'Video uploaded successfully', 
            id: result.insertId,
            youtubeUrl: youtubeUrl 
        });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ success: false, message: 'Failed to upload video' });
    }
});

// Get all videos
app.get('/api/videos', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM videos ORDER BY created_at DESC');
        res.json({ success: true, videos: rows });
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch videos' });
    }
});

// Delete video (Admin only)
app.delete('/api/videos/:id', authenticateToken, async (req, res) => {
    try {
        const videoId = req.params.id;
        
        // Get video filename before deleting
        const [rows] = await db.execute('SELECT video_file, youtube_video_id FROM videos WHERE id = ?', [videoId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Video not found' });
        }
        
        const videoFile = rows[0].video_file;
        const videoPath = path.join(__dirname, 'uploads/videos', videoFile);
        
        // Delete from database
        const [result] = await db.execute('DELETE FROM videos WHERE id = ?', [videoId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Video not found' });
        }
        
        // Delete video file
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
            console.log(`🗑️  Deleted video file: ${videoFile}`);
        }
        
        res.json({ success: true, message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ success: false, message: 'Failed to delete video' });
    }
});

// YouTube Setup Routes - IMPROVED WITH HTML INTERFACE

// Main YouTube setup page with instructions
app.get('/api/youtube/setup', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>YouTube Setup - Pure Pleasure Interior Design</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%);
                color: #f5f5f5;
                min-height: 100vh;
            }
            .container {
                background: rgba(255, 255, 255, 0.1);
                padding: 30px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            h1 {
                color: #ffd700;
                text-align: center;
                margin-bottom: 30px;
            }
            .step {
                background: rgba(255, 255, 255, 0.05);
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                border-left: 4px solid #ffd700;
            }
            .step-number {
                background: #ffd700;
                color: #1a0b2e;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                margin-right: 10px;
            }
            .btn {
                display: inline-block;
                background: #ffd700;
                color: #1a0b2e;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 10px 5px;
                transition: all 0.3s ease;
            }
            .btn:hover {
                background: #ffed4e;
                transform: translateY(-2px);
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            .btn-secondary:hover {
                background: #5a6268;
            }
            .status {
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .status.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            .status.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .token-display {
                background: rgba(0, 0, 0, 0.3);
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
                word-break: break-all;
                font-family: monospace;
            }
            .instructions {
                background: rgba(255, 215, 0, 0.1);
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
                border-left: 4px solid #ffd700;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 YouTube Integration Setup</h1>
            
            <div class="instructions">
                <p><strong>Before you start:</strong> Make sure you have created a Google Cloud Project with YouTube Data API v3 enabled, and created OAuth 2.0 credentials with the redirect URI set to:</p>
                <div class="token-display">${process.env.YOUTUBE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/youtube/callback`}</div>
            </div>

            <div class="step">
                <span class="step-number">1</span>
                <strong>Start OAuth Flow</strong>
                <p>Click the button below to begin the YouTube authentication process. This will redirect you to Google's OAuth consent screen.</p>
                <a href="/api/youtube/auth-web" class="btn" target="_blank" rel="noopener">Start YouTube Authentication</a>
            </div>

            <div class="step">
                <span class="step-number">2</span>
                <strong>Complete OAuth Consent</strong>
                <p>You'll be redirected to Google to authorize the application. Make sure to grant all requested permissions.</p>
            </div>

            <div class="step">
                <span class="step-number">3</span>
                <strong>Get Refresh Token</strong>
                <p>After authorization, you'll be redirected back and shown your refresh token. Copy this token.</p>
            </div>

            <div class="step">
                <span class="step-number">4</span>
                <strong>Update Environment</strong>
                <p>Add the refresh token to your .env file:</p>
                <div class="token-display">YOUTUBE_REFRESH_TOKEN=your_refresh_token_here</div>
            </div>

            <div class="step">
                <span class="step-number">5</span>
                <strong>Test Connection</strong>
                <p>After adding the token and restarting the server, test the connection:</p>
                <a href="/api/youtube/test" class="btn" target="_blank">Test YouTube Connection</a>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <a href="/api/youtube/status" class="btn btn-secondary">Check Current Status</a>
                <a href="/api/health" class="btn btn-secondary">Server Health</a>
            </div>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// Web OAuth flow for YouTube authentication
app.get('/api/youtube/auth-web', (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/youtube/callback`
    );

    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.redirect(authUrl);
});

// OAuth callback for web flow - returns user-friendly HTML page
app.get('/api/youtube/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    
    if (error) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>YouTube Authentication Failed</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 600px; 
                    margin: 50px auto; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%);
                    color: #f5f5f5;
                }
                .error { 
                    background: #f8d7da; 
                    color: #721c24; 
                    padding: 20px; 
                    border-radius: 5px; 
                    border: 1px solid #f5c6cb;
                }
                .btn { 
                    display: inline-block; 
                    background: #ffd700; 
                    color: #1a0b2e; 
                    padding: 10px 20px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin-top: 20px; 
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>❌ Authentication Failed</h2>
                <p><strong>Error:</strong> ${error}</p>
                <p>Please try again or check your Google Cloud Console configuration.</p>
                <a href="/api/youtube/setup" class="btn">Try Again</a>
            </div>
        </body>
        </html>
        `;
        return res.send(html);
    }
    
    if (!code) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Error</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 600px; 
                    margin: 50px auto; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%);
                    color: #f5f5f5;
                }
                .error { 
                    background: #f8d7da; 
                    color: #721c24; 
                    padding: 20px; 
                    border-radius: 5px; 
                    border: 1px solid #f5c6cb;
                }
                .btn { 
                    display: inline-block; 
                    background: #ffd700; 
                    color: #1a0b2e; 
                    padding: 10px 20px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin-top: 20px; 
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>❌ Authorization Code Missing</h2>
                <p>No authorization code was provided. Please try the authentication process again.</p>
                <a href="/api/youtube/setup" class="btn">Try Again</a>
            </div>
        </body>
        </html>
        `;
        return res.send(html);
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/youtube/callback`
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            throw new Error('No refresh token received. Make sure to include prompt=consent in the auth request.');
        }
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>YouTube Authentication Successful</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 700px; 
                    margin: 50px auto; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%);
                    color: #f5f5f5;
                }
                .success { 
                    background: #d4edda; 
                    color: #155724; 
                    padding: 20px; 
                    border-radius: 5px; 
                    border: 1px solid #c3e6cb;
                }
                .token { 
                    background: rgba(0, 0, 0, 0.3); 
                    padding: 15px; 
                    border-radius: 5px; 
                    margin: 15px 0; 
                    word-break: break-all; 
                    font-family: monospace;
                    color: #ffd700;
                }
                .btn { 
                    display: inline-block; 
                    background: #ffd700; 
                    color: #1a0b2e; 
                    padding: 10px 20px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin: 10px 5px; 
                    font-weight: bold;
                }
                .instructions {
                    background: rgba(255, 215, 0, 0.1);
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                    border-left: 4px solid #ffd700;
                }
            </style>
        </head>
        <body>
            <div class="success">
                <h2>✅ YouTube Authentication Successful!</h2>
                <p>Your refresh token has been generated. Copy it and add it to your environment variables:</p>
                
                <div class="instructions">
                    <strong>Add this to your .env file:</strong>
                    <div class="token">YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}</div>
                </div>

                <div class="instructions">
                    <strong>Next steps:</strong>
                    <ol>
                        <li>Copy the refresh token above</li>
                        <li>Add it to your .env file as YOUTUBE_REFRESH_TOKEN</li>
                        <li>Restart your server</li>
                        <li>Test the connection using the button below</li>
                    </ol>
                </div>

                <div style="margin-top: 20px;">
                    <a href="/api/youtube/test" class="btn" target="_blank">Test Connection</a>
                    <a href="/api/youtube/setup" class="btn">Back to Setup</a>
                </div>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        console.error('Error getting tokens:', error);
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Token Exchange Failed</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 600px; 
                    margin: 50px auto; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%);
                    color: #f5f5f5;
                }
                .error { 
                    background: #f8d7da; 
                    color: #721c24; 
                    padding: 20px; 
                    border-radius: 5px; 
                    border: 1px solid #f5c6cb;
                }
                .btn { 
                    display: inline-block; 
                    background: #ffd700; 
                    color: #1a0b3e; 
                    padding: 10px 20px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin-top: 20px; 
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>❌ Token Exchange Failed</h2>
                <p><strong>Error:</strong> ${error.message}</p>
                <p>This might be due to:</p>
                <ul>
                    <li>Invalid client ID or secret</li>
                    <li>Mismatched redirect URI</li>
                    <li>Authorization code already used</li>
                    <li>Network connectivity issues</li>
                </ul>
                <a href="/api/youtube/setup" class="btn">Try Again</a>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    }
});

// YouTube status check
app.get('/api/youtube/status', async (req, res) => {
    const hasClientId = !!process.env.YOUTUBE_CLIENT_ID;
    const hasClientSecret = !!process.env.YOUTUBE_CLIENT_SECRET;
    const hasRefreshToken = !!process.env.YOUTUBE_REFRESH_TOKEN;
    
    let connectionStatus = 'Not configured';
    let channelInfo = null;
    
    if (hasClientId && hasClientSecret && hasRefreshToken) {
        try {
            const auth = getYouTubeAuth();
            const response = await youtube.channels.list({
                auth: auth,
                part: 'snippet',
                mine: true
            });
            
            connectionStatus = 'Connected';
            channelInfo = response.data.items[0].snippet;
        } catch (error) {
            connectionStatus = `Error: ${error.message}`;
        }
    }
    
    res.json({
        success: true,
        status: {
            clientId: hasClientId ? 'Configured' : 'Missing',
            clientSecret: hasClientSecret ? 'Configured' : 'Missing',
            refreshToken: hasRefreshToken ? 'Configured' : 'Missing',
            connection: connectionStatus,
            channel: channelInfo
        }
    });
});

// Test YouTube connection
app.get('/api/youtube/test', async (req, res) => {
    try {
        const auth = getYouTubeAuth();
        
        const response = await youtube.channels.list({
            auth: auth,
            part: 'snippet',
            mine: true
        });

        res.json({
            success: true,
            message: 'YouTube connection successful!',
            channel: response.data.items[0].snippet
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'YouTube connection failed: ' + error.message
        });
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

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
    });
}

// Error handling for file uploads
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB for images, 500MB for videos.' });
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
        console.log(`🎥 Videos directory: ${videosDir}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        console.log(`👤 Default admin: admin / admin123`);
        console.log('\n📋 Supported database connection methods:');
        console.log('   1. DATABASE_URL (connection string)');
        console.log('   2. MYSQLHOST, MYSQLUSER, MYSQLPASSWORD (Railway default)');
        console.log('   3. DB_HOST, DB_USER, DB_PASSWORD (custom)');
        console.log('   4. MYSQL_interiordesign (custom connection string)');
        console.log('\n🎬 YouTube Integration Setup:');
        console.log(`   - Setup page: http://localhost:${PORT}/api/youtube/setup`);
        console.log(`   - Status check: http://localhost:${PORT}/api/youtube/status`);
        console.log(`   - Test connection: http://localhost:${PORT}/api/youtube/test`);
        console.log('\n🔑 To set up YouTube:');
        console.log(`   1. Visit: http://localhost:${PORT}/api/youtube/setup`);
        console.log('   2. Click "Start YouTube Authentication"');
        console.log('   3. Complete the OAuth flow in your browser');
        console.log('   4. Copy the refresh token from the success page');
        console.log('   5. Add it to your .env file as YOUTUBE_REFRESH_TOKEN');
        console.log('   6. Restart the server and test the connection');
        console.log('\n🌐 CORS Configuration:');
        console.log('   Allowed origins:', allowedOrigins);
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