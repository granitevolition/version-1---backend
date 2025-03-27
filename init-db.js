/**
 * This script initializes the database schema
 * Usage: node init-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');

// Database schema
const schema = `
-- Database schema for user registration system

-- Create users table
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

async function initializeDatabase() {
  // Create a connection to the database
  const connectionString = process.env.DATABASE_PUBLIC_URL || 
                           process.env.DATABASE_URL || 
                           process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('Error: No database connection string found');
    console.error('Please set DATABASE_PUBLIC_URL, DATABASE_URL, or POSTGRES_URL');
    process.exit(1);
  }

  console.log(`Connecting to database using: ${connectionString.replace(/:[^:]*@/, ':****@')}`);
  
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Railway Postgres
    }
  });

  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to database');

    // Execute the schema
    console.log('Creating database schema...');
    await client.query(schema);
    console.log('Database schema created successfully');

    // Check if the users table was created
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Users table exists');
    } else {
      console.error('❌ Failed to create users table');
    }

    // Close the connection
    client.release();
    
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    // Close the pool
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the initialization
initializeDatabase().catch(console.error);
