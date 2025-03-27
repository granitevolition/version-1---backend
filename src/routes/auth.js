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
      // First make sure the users table exists
      const userTableExists = await checkTableExists('users');
      
      if (!userTableExists) {
        return res.status(500).json({
          error: 'Database Setup Error',
          message: 'The users table does not exist in the database.'
        });
      }
      
      // Get the columns that exist in the users table
      const userColumns = await getTableColumns('users');
      console.log('Available columns in users table:', userColumns);
      
      // Build a query based on available columns
      let query = 'SELECT id, username, password_hash';
      
      // Add email and phone fields if they exist
      if (userColumns.includes('email')) {
        query += ', email';
      }
      if (userColumns.includes('phone')) {
        query += ', phone';
      }
      
      query += ' FROM users WHERE username = $1';
      
      // Get user by username
      const userResult = await db.query(query, [username]);
      
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
      
      // Check if sessions table exists and create it if it doesn't
      let sessionTableExists = await checkTableExists('user_sessions');
      
      if (!sessionTableExists) {
        // Create sessions table
        try {
          await db.query(`
            CREATE TABLE user_sessions (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL,
              session_token VARCHAR(255) UNIQUE NOT NULL,
              expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              ip_address VARCHAR(45),
              user_agent TEXT,
              CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
          `);
          console.log('Created user_sessions table');
          sessionTableExists = true;
        } catch (error) {
          console.error('Error creating user_sessions table:', error);
          // Respond with success but without session token if we can't create the sessions table
          return res.status(200).json({
            message: 'Login successful (without session)',
            user: {
              id: user.id,
              username: user.username,
              email: user.email
            }
          });
        }
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
      
      // Update user's last_login timestamp if the column exists
      if (userColumns.includes('last_login')) {
        await db.query(
          'UPDATE users SET last_login = NOW() WHERE id = $1',
          [user.id]
        );
      }
      
      // Return success with session token
      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone
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
    
    // Check if sessions table exists
    const sessionTableExists = await checkTableExists('user_sessions');
    
    if (!sessionTableExists) {
      // No sessions table, can't logout but not an error
      return res.status(200).json({
        message: 'Logout successful'
      });
    }
    
    // Delete session
    const result = await db.query(
      'DELETE FROM user_sessions WHERE session_token = $1 RETURNING id',
      [sessionToken]
    );
    
    // Return success regardless of whether session was found
    // This is a security best practice
    res.status(200).json({
      message: 'Logout successful'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    // Always return success for logout attempts
    res.status(200).json({
      message: 'Logout successful'
    });
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
    
    // Check if sessions table exists
    const sessionTableExists = await checkTableExists('user_sessions');
    
    if (!sessionTableExists) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session'
      });
    }
    
    // Get columns in users table
    const userColumns = await getTableColumns('users');
    
    // Build the join query based on available columns
    let joinQuery = `
      SELECT s.id, s.user_id, s.expires_at, u.username
    `;
    
    // Add optional columns if they exist
    if (userColumns.includes('email')) {
      joinQuery += ', u.email';
    }
    if (userColumns.includes('phone')) {
      joinQuery += ', u.phone';
    }
    
    joinQuery += `
      FROM user_sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `;
    
    // Get session from database
    const sessionResult = await db.query(joinQuery, [sessionToken]);
    
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
        username: session.username,
        email: session.email,
        phone: session.phone
      },
      session: {
        id: session.id,
        expires_at: session.expires_at
      }
    });
    
  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Session verification failed'
    });
  }
});

/**
 * Check if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - True if table exists
 */
const checkTableExists = async (tableName) => {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  
  return result.rows[0].exists;
};

/**
 * Get the column names for a table
 * @param {string} tableName - Name of the table
 * @returns {Promise<string[]>} - Array of column names
 */
const getTableColumns = async (tableName) => {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1;
  `, [tableName]);
  
  return result.rows.map(row => row.column_name);
};

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
