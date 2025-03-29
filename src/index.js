const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const db = require('./db');
const { initializeTables } = require('./db/migration');

// Import routes
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const humanizeRoutes = require('./routes/humanize'); // Import the humanize routes
const diagnosticRoutes = require('./routes/diagnostic'); // Import the diagnostic routes
const apiProxyRoutes = require('./routes/apiProxy'); // Import the new API proxy routes

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
      },
      apiProxy: {
        status: 'available',
        message: 'Enhanced Puppeteer API proxy enabled',
        endpoints: {
          health: '/api/proxy/health',
          proxy: '/api/proxy/{path}'
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
      diagnostic: `${API_PREFIX}/diagnostic`,
      apiProxy: '/api/proxy',
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
      diagnostic: `${API_PREFIX}/diagnostic`,
      apiProxy: '/api/proxy'
    }
  });
});

// Setup API routes
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/humanize`, humanizeRoutes);
app.use(`${API_PREFIX}/diagnostic`, diagnosticRoutes);

// Register API Proxy routes
app.use('/api/proxy', apiProxyRoutes);

// Also make diagnostic routes available without API prefix for easier access
app.use('/diagnostic', diagnosticRoutes);
app.use('/diag', diagnosticRoutes); // Shorter alias

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    status: status,
    timestamp: new Date().toISOString()
  });
});

// Start server
(async () => {
  try {
    // Initialize DB tables if needed
    await initializeTables();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base: http://localhost:${PORT}${API_PREFIX}`);
      console.log(`API Proxy: http://localhost:${PORT}/api/proxy`);
      console.log(`Diagnostic tools: http://localhost:${PORT}/diagnostic/system`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

// Export for testing
module.exports = app;