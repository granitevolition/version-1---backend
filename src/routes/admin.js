const express = require('express');
const db = require('../db');

const router = express.Router();

// Initialize database
router.post('/initialize-db', async (req, res, next) => {
  try {
    // Check if database connection is available
    if (!db.hasConnection) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database connection is not available. Please try again later.',
        details: 'The server is missing DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL configuration'
      });
    }

    // Schema for users table
    const schema = `
      -- Create users table if it doesn't exist
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Index on username for faster lookups
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `;

    // Execute the schema
    await db.query(schema);

    // Check if the users table was successfully created
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      // Get user count
      const countResult = await db.query('SELECT COUNT(*) as count FROM users');
      const userCount = countResult.rows[0].count;
      
      return res.status(200).json({
        message: 'Database initialized successfully',
        table_created: true,
        user_count: userCount
      });
    } else {
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to create users table'
      });
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    next(error);
  }
});

// Get database status
router.get('/db-status', async (req, res, next) => {
  try {
    // Check if database connection is available
    if (!db.hasConnection) {
      return res.status(200).json({
        connected: false,
        message: 'Database connection is not available'
      });
    }

    // Try to execute a simple query to verify connectivity
    try {
      const result = await db.query('SELECT NOW() as time');
      
      // Check if users table exists
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      const usersTableExists = tableCheck.rows[0].exists;
      
      // Get user count if the table exists
      let userCount = 0;
      if (usersTableExists) {
        const countResult = await db.query('SELECT COUNT(*) as count FROM users');
        userCount = parseInt(countResult.rows[0].count);
      }
      
      return res.status(200).json({
        connected: true,
        server_time: result.rows[0].time,
        users_table_exists: usersTableExists,
        user_count: userCount
      });
    } catch (queryError) {
      return res.status(200).json({
        connected: false,
        message: 'Database query failed',
        error: queryError.message
      });
    }
  } catch (error) {
    console.error('Database status error:', error);
    next(error);
  }
});

module.exports = router;
