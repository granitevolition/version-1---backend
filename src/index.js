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

// Health check endpoint - must be registered before other routes
// to ensure it works even if other routes have errors
app.get('/health', (req, res) => {
  const healthy = db.hasConnection;
  const status = healthy ? 'healthy' : 'degraded';
  const statusCode = healthy ? 200 : 200; // Always return 200 for health checks

  res.status(statusCode).json({
    status: status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: {
        status: db.hasConnection ? 'connected' : 'disconnected',
        message: db.hasConnection ? 'PostgreSQL connected' : 'PostgreSQL connection failed'
      }
    }
  });
});

// Pre-flight options for CORS
app.options('*', cors());

// Register routes
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/humanize`, humanizeRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      users: `${API_PREFIX}/users`,
      auth: `${API_PREFIX}/auth`,
      humanize: `${API_PREFIX}/humanize`,
      health: '/health'
    }
  });
});

// API prefix route
app.get(API_PREFIX, (req, res) => {
  res.json({
    message: 'API v1',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      users: `${API_PREFIX}/users`,
      auth: `${API_PREFIX}/auth`,
      humanize: `${API_PREFIX}/humanize`,
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource '${req.originalUrl}' was not found on this server.`
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Server Error',
    message: err.message || 'An unexpected error occurred'
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
      // Continue starting the server despite migration errors
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} at:`, new Date().toISOString());
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    
    // Try to start server anyway to serve at least health check endpoint
    try {
      app.listen(PORT, () => {
        console.log(`Server running in LIMITED MODE on port ${PORT} at:`, new Date().toISOString());
        console.log('Only health check and basic endpoints available!');
      });
    } catch (fallbackError) {
      console.error('Fatal error, could not start server:', fallbackError);
      process.exit(1);
    }
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
