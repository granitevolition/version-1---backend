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

// Auto-initialize database on startup
const db = require('./db');
if (db.hasConnection) {
  const initializeDb = async () => {
    try {
      console.log('Attempting to initialize database on startup...');
      
      // Enhanced schema for users table with email and phone
      const schema = `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          phone VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        
        -- Create user_sessions table for handling login sessions
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(45),
          user_agent TEXT,
          CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      `;

      // Execute the schema
      await db.query(schema);
      
      // Check if the tables were successfully created
      const tableCheck = await db.query(`
        SELECT 
          (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')) as users_exists,
          (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions')) as sessions_exists;
      `);
      
      if (tableCheck.rows[0].users_exists && tableCheck.rows[0].sessions_exists) {
        console.log('Database initialized successfully - all tables exist');
      } else {
        console.error('Failed to create some tables during initialization:', tableCheck.rows[0]);
      }
      
      // Check for needed column migrations
      const columnCheck = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users';
      `);
      
      const columns = columnCheck.rows.map(row => row.column_name);
      
      // Add email column if it doesn't exist
      if (!columns.includes('email')) {
        console.log('Adding email column to users table...');
        await db.query(`
          ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
      }
      
      // Add phone column if it doesn't exist
      if (!columns.includes('phone')) {
        console.log('Adding phone column to users table...');
        await db.query(`
          ALTER TABLE users ADD COLUMN phone VARCHAR(20);
        `);
      }
      
      // Add last_login column if it doesn't exist
      if (!columns.includes('last_login')) {
        console.log('Adding last_login column to users table...');
        await db.query(`
          ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
        `);
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
