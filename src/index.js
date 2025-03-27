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

// Advanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow any origin in development, or specific origins in production
    const allowedOrigins = [
      // Frontend origins
      'https://version-1-frontend-production.up.railway.app',
      'https://version-1---frontend-production.up.railway.app',
      // Allow localhost for development
      'http://localhost:3000',
      'http://localhost:5000',
      // Allow null origin (for local file requests, etc.)
      undefined,
      'null'
    ];
    
    // In development allow all origins
    if (process.env.NODE_ENV === 'development' || !origin) {
      return callback(null, true);
    }
    
    // In production, check against allowed list
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log('CORS blocked request from:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions)); // Apply CORS with options
app.use(helmet({
  // Allow cross-origin for Railway and other platforms
  crossOriginResourcePolicy: { policy: 'cross-origin' }
})); 
app.use(morgan('dev')); // Logging
app.use(express.json()); // JSON body parser

// Route prefix
const API_PREFIX = '/api/v1';

// Health check endpoint - must be registered before other routes
// to ensure it works even if other routes have errors
app.get('/health', (req, res) => {
  const healthy = db.hasConnection;
  const status = healthy ? 'healthy' : 'degraded';
  const statusCode = 200; // Always return 200 for health checks

  res.status(statusCode).json({
    status: status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: {
        status: db.hasConnection ? 'connected' : 'disconnected',
        message: db.hasConnection ? 'PostgreSQL connected' : 'PostgreSQL connection failed',
        env: {
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
          DATABASE_PUBLIC_URL_EXISTS: !!process.env.DATABASE_PUBLIC_URL,
          POSTGRES_URL_EXISTS: !!process.env.POSTGRES_URL
        }
      }
    }
  });
});

// Pre-flight options for CORS
app.options('*', cors(corsOptions));

// Debug endpoint to check request headers
app.get('/debug-cors', (req, res) => {
  res.json({
    headers: req.headers,
    origin: req.headers.origin,
    host: req.headers.host,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    status: 'online',
    timestamp: new Date().toISOString(),
    database_connected: db.hasConnection,
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
    database_connected: db.hasConnection,
    endpoints: {
      users: `${API_PREFIX}/users`,
      auth: `${API_PREFIX}/auth`,
      humanize: `${API_PREFIX}/humanize`,
      health: '/health'
    }
  });
});

// Register routes - with database connection check middleware
const dbCheckMiddleware = (req, res, next) => {
  if (!db.hasConnection) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection is not available. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Register routes with DB check middleware
app.use(`${API_PREFIX}/users`, dbCheckMiddleware, usersRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes); // Auth routes handle DB connection checks internally
app.use(`${API_PREFIX}/humanize`, humanizeRoutes);

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
  
  // Handle CORS errors specially
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CORS policy violation: origin not allowed',
      details: 'The origin of this request is not allowed to access this resource'
    });
  }
  
  res.status(500).json({
    error: 'Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Initialize database and start server
async function startServer() {
  let serverStarted = false;
  const startTime = new Date().toISOString();
  
  // Start the server regardless of database connection
  const server = app.listen(PORT, () => {
    serverStarted = true;
    console.log(`Server started in provisional mode on port ${PORT} at: ${startTime}`);
    console.log(`Health check: /health`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  
  // Try to connect to the database
  try {
    console.log('Attempting database connection...');
    
    // Attempt database connection with retry logic
    let connected = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!connected && attempts < maxAttempts) {
      attempts++;
      try {
        connected = await db.connect();
        if (connected) {
          console.log(`Database connected successfully after ${attempts} attempt(s) at:`, new Date().toISOString());
          break;
        }
      } catch (connectionError) {
        console.error(`Database connection attempt ${attempts} failed:`, connectionError);
        if (attempts < maxAttempts) {
          console.log(`Waiting 3 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    if (!connected) {
      console.error(`Failed to connect to database after ${maxAttempts} attempts`);
      // Continue in limited mode
      return;
    }
    
    // Initialize database tables
    try {
      console.log('Creating database tables if needed...');
      await initializeTables();
      console.log('Database tables initialized at:', new Date().toISOString());
      
      // Initialize humanize tables
      console.log('Creating humanize tracking tables...');
      await createHumanizeTables();
      console.log('Humanize tables initialized');
      
      // If we got here, the database is fully initialized
      if (serverStarted) {
        console.log(`Server now fully operational with database at: ${new Date().toISOString()}`);
        console.log(`API endpoint: ${API_PREFIX}`);
      }
    } catch (migrationError) {
      console.error('Error during database initialization:', migrationError);
      // Continue with server running but migrations might have failed
    }
  } catch (error) {
    console.error('Error during startup:', error);
    // Server is already running in limited mode
  }
}

// Run the startup procedure
startServer().catch(error => {
  console.error('Fatal error during startup:', error);
});

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
