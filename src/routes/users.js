const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
  console.log('Registration request received:', req.body);
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
    console.log('Processing registration for username:', username);
    
    // Validate input
    if (!username || !password) {
      console.log('Validation failed: missing username or password');
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
      
      console.log('Table check result:', tableCheck.rows[0]);
      
      if (!tableCheck.rows[0].exists) {
        console.log('Users table does not exist - attempting to create it');
        
        // Create the users table
        await db.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        `);
        
        console.log('Users table created successfully');
      }
      
      // Check if username already exists
      const existingUser = await db.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      console.log('Existing user check result:', { count: existingUser.rows.length });
      
      if (existingUser.rows.length > 0) {
        console.log('Username already exists');
        return res.status(409).json({ 
          error: 'Conflict',
          message: 'Username already exists' 
        });
      }
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      console.log('Password hashed successfully');
      
      // Insert the new user
      console.log('Attempting to insert user into database...');
      const insertQuery = 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at';
      const insertValues = [username, passwordHash];
      console.log('Insert query:', insertQuery);
      console.log('Insert values:', [username, '***REDACTED***']);
      
      const result = await db.query(insertQuery, insertValues);
      
      console.log('Insert query result:', result);
      console.log('Insert rows:', result.rows);
      
      // Check if insertion was successful
      if (!result.rows || result.rows.length === 0) {
        console.error('Failed to insert user: no rows returned from insert query');
        throw new Error('Failed to insert user into database');
      }
      
      const newUser = result.rows[0];
      console.log('New user created:', newUser);
      
      // Return the newly created user
      res.status(201).json(newUser);
      
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
    console.error('Registration error:', error.message);
    console.error(error.stack);
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
