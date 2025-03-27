const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
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
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Username and password are required' 
      });
    }
    
    try {
      // Check if username already exists
      const existingUser = await db.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Conflict',
          message: 'Username already exists' 
        });
      }
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      // Insert the new user
      const result = await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
        [username, passwordHash]
      );
      
      // Return the newly created user
      res.status(201).json(result.rows[0]);
    } catch (dbError) {
      console.error('Database operation failed:', dbError.message);
      
      // Check if the error is related to missing tables
      if (dbError.message.includes('relation "users" does not exist')) {
        return res.status(500).json({
          error: 'Database Setup Error',
          message: 'The users table does not exist in the database.',
          details: 'Database is connected but schema has not been initialized. Run the schema.sql script.'
        });
      }
      
      throw dbError; // re-throw to be caught by the outer catch
    }
    
  } catch (error) {
    next(error);
  }
});

// Add a status endpoint to check user service health
router.get('/status', (req, res) => {
  res.json({
    service: 'User registration service',
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
