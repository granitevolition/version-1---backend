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
