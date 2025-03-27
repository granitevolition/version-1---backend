const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// Function to generate a secure session token
const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Login endpoint
router.post('/login', async (req, res, next) => {
  console.log('Login request received:', { ...req.body, password: '[REDACTED]' });
  
  try {
    // Check if database connection is available
    if (!db.hasConnection) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database connection is not available. Please try again later.',
        details: 'The server is missing DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL configuration'
      });
    }

    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required'
      });
    }
    
    try {
      // First check if the users table exists
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        return res.status(500).json({
          error: 'Database Setup Error',
          message: 'The users table does not exist in the database.'
        });
      }
      
      // Get user by username
      const userResult = await db.query(
        'SELECT id, username, password_hash FROM users WHERE username = $1',
        [username]
      );
      
      if (userResult.rows.length === 0) {
        // No user found with that username
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid username or password'
        });
      }
      
      const user = userResult.rows[0];
      
      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        // Password doesn't match
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid username or password'
        });
      }
      
      // Password is valid, create session
      // Check if sessions table exists and create it if it doesn't
      const sessionsTableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_sessions'
        );
      `);
      
      if (!sessionsTableCheck.rows[0].exists) {
        // Create user_sessions table
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            session_token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(45),
            user_agent TEXT,
            CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
          );
          
          CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
        `);
      }
      
      // Generate session token
      const sessionToken = generateSessionToken();
      
      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      // Get IP address and user agent from request
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      // Store session in database
      await db.query(
        'INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [user.id, sessionToken, expiresAt, ipAddress, userAgent]
      );
      
      // Update user's last_login timestamp
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
      
      // Return success with session token
      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username
        },
        session: {
          token: sessionToken,
          expires_at: expiresAt
        }
      });
      
    } catch (dbError) {
      console.error('Database operation failed:', dbError.message);
      console.error(dbError.stack);
      
      // Check if the error is related to missing tables
      if (dbError.message.includes('relation "users" does not exist')) {
        return res.status(500).json({
          error: 'Database Setup Error',
          message: 'The users table does not exist in the database.',
          details: 'Database is connected but schema has not been initialized.'
        });
      }
      
      throw dbError; // re-throw to be caught by the outer catch
    }
    
  } catch (error) {
    console.error('Login error:', error.message);
    console.error(error.stack);
    next(error);
  }
});

// Logout endpoint
router.post('/logout', async (req, res, next) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session token is required'
      });
    }
    
    // Delete session
    const result = await db.query(
      'DELETE FROM user_sessions WHERE session_token = $1 RETURNING id',
      [sessionToken]
    );
    
    if (result.rows.length === 0) {
      // Session not found
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }
    
    // Return success
    res.status(200).json({
      message: 'Logout successful'
    });
    
  } catch (error) {
    next(error);
  }
});

// Verify session endpoint
router.post('/verify-session', async (req, res, next) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session token is required'
      });
    }
    
    // Get session from database
    const sessionResult = await db.query(
      `SELECT s.id, s.user_id, s.expires_at, u.username 
       FROM user_sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.session_token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );
    
    if (sessionResult.rows.length === 0) {
      // Session not found or expired
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Return user info
    res.status(200).json({
      message: 'Session valid',
      user: {
        id: session.user_id,
        username: session.username
      },
      session: {
        id: session.id,
        expires_at: session.expires_at
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Add a status endpoint to check auth service health
router.get('/status', (req, res) => {
  res.json({
    service: 'Authentication service',
    status: 'running',
    database: {
      connected: db.hasConnection,
      message: db.hasConnection 
        ? 'Database connection is available' 
        : 'Database connection is not available'
    }
  });
});

module.exports = router;
