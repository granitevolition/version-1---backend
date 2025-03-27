require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Check for required environment variables
const connectionString = process.env.DATABASE_PUBLIC_URL || 
                         process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn('WARNING: No database connection string found.');
  console.warn('Database operations will fail until DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL is set.');
  console.warn('The server will start, but user registration will not work properly.');
  
  // Log environment variables to help with debugging (hide sensitive data)
  console.log('Available environment variables:');
  Object.keys(process.env).forEach(key => {
    if (key.includes('DATABASE') || key.includes('POSTGRES') || key === 'PORT') {
      console.log(`- ${key}: ${key.includes('PASSWORD') ? '[HIDDEN]' : process.env[key]}`);
    }
  });
}

// Import routes
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const testRoutes = require('./routes/test');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS more explicitly
const corsOptions = {
  origin: '*', // Allow any origin for testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
};

// Middleware
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // Enable CORS for frontend with specific options
app.use(morgan('dev')); // Request logging
app.use(express.json()); // Parse JSON request bodies

// Debugging middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    // Mask sensitive data in logs
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
    if (sanitizedBody.sessionToken) sanitizedBody.sessionToken = '[REDACTED]';
    console.log('Request body:', sanitizedBody);
  }
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/test', testRoutes);

// Root endpoint for basic availability testing
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'API server is running',
    time: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  // Include database status in health check
  const dbConnected = !!connectionString;
  
  res.status(200).json({ 
    status: 'ok',
    database: {
      connected: dbConnected,
      message: dbConnected ? 'Database connection string found' : 'No database connection string found'
    },
    env: process.env.NODE_ENV || 'development'
  });
});

// Database status endpoint
app.get('/api/status/database', (req, res) => {
  res.status(200).json({
    connected: !!connectionString,
    variables: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_PUBLIC_URL: !!process.env.DATABASE_PUBLIC_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL
    }
  });
});

// Initialize database with safe migrations
const db = require('./db');
const { runMigrations } = require('./utils/dbMigration');

if (db.hasConnection) {
  // Run database migrations
  runMigrations()
    .then(success => {
      if (success) {
        console.log('Database successfully initialized with migrations.');
      } else {
        console.error('Database migrations failed. Some features may not work properly.');
      }
    })
    .catch(error => {
      console.error('Error during database initialization:', error.message);
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error caught by global error handler:');
  console.error(err.stack);
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // For testing
