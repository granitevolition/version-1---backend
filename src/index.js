const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const db = require('./db');
const { initializeTables } = require('./db/migration');
const { createHumanizeTables } = require('./db/migrations/humanize_tables');

// Import routes
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const humanizeRoutes = require('./routes/humanize');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for all routes
app.use(morgan('dev')); // Logging
app.use(express.json()); // JSON body parser

// Route prefix
const API_PREFIX = '/api/v1';

// Register routes
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/humanize`, humanizeRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    endpoints: {
      users: `${API_PREFIX}/users`,
      auth: `${API_PREFIX}/auth`,
      humanize: `${API_PREFIX}/humanize`
    }
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Server Error',
    message: err.message
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    await db.connect();
    console.log('Database connected successfully at:', new Date().toISOString());
    
    // Initialize database tables
    try {
      await initializeTables();
      console.log('Database tables initialized at:', new Date().toISOString());
      
      // Initialize humanize tables
      await createHumanizeTables();
      console.log('Humanize tables initialized at:', new Date().toISOString());
    } catch (migrationError) {
      console.error('Error during database initialization:', migrationError);
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} at:`, new Date().toISOString());
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  db.disconnect()
    .then(() => {
      console.log('Database disconnected successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error during database disconnection:', err);
      process.exit(1);
    });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  db.disconnect()
    .then(() => {
      console.log('Database disconnected successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error during database disconnection:', err);
      process.exit(1);
    });
});

module.exports = app;
