require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Check for required environment variables
const connectionString = process.env.DATABASE_URL || 
                         process.env.DATABASE_PUBLIC_URL || 
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
const adminRoutes = require('./routes/admin');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for frontend
app.use(morgan('dev')); // Request logging
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

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

// Auto-initialize database on startup
const db = require('./db');
if (db.hasConnection) {
  const adminRoute = require('./routes/admin');
  const initializeDb = async () => {
    try {
      console.log('Attempting to initialize database on startup...');
      
      // Schema for users table
      const schema = `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      `;

      // Execute the schema
      await db.query(schema);
      
      // Check if the users table was successfully created
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('Database initialized successfully - users table exists');
      } else {
        console.error('Failed to create users table during initialization');
      }
    } catch (error) {
      console.error('Error during database initialization:', error.message);
    }
  };
  
  // Run initialization
  initializeDb().catch(console.error);
}

// Error handling middleware
app.use((err, req, res, next) => {
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
