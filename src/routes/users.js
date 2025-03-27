const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Username and password are required' 
      });
    }
    
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
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
