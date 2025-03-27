const { Pool } = require('pg');
require('dotenv').config();

let pool;
let hasConnection = false;

// Initialize the database connection pool
const createPool = () => {
  // Get the database URL from the environment variable
  const databaseUrl = process.env.DATABASE_URL || 
                     process.env.DATABASE_PUBLIC_URL || 
                     process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    console.error('No database URL provided. Set DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL environment variable.');
    return null;
  }
  
  console.log('Connecting to database using:', databaseUrl.replace(/:([^:@]+)@/, ':****@'));
  
  try {
    return new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  } catch (error) {
    console.error('Error creating database pool:', error);
    return null;
  }
};

// Initialize the pool
pool = createPool();

// Check if connection works
const testConnection = async () => {
  if (!pool) {
    console.error('Database pool not initialized');
    hasConnection = false;
    return false;
  }
  
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      hasConnection = true;
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection test failed:', error);
    hasConnection = false;
    return false;
  }
};

// Connect to database
const connect = async () => {
  try {
    if (!pool) {
      pool = createPool();
    }
    
    const success = await testConnection();
    hasConnection = success;
    
    if (success) {
      console.log('Database connected successfully at:', new Date().toISOString());
    } else {
      console.error('Database connection failed at:', new Date().toISOString());
    }
    
    return success;
  } catch (error) {
    console.error('Database connection error:', error);
    hasConnection = false;
    return false;
  }
};

// Run the connection test immediately
testConnection()
  .then(success => {
    console.log('Initial database connection test:', success ? 'SUCCESS' : 'FAILED');
  })
  .catch(error => {
    console.error('Error during initial database connection test:', error);
  });

// Execute a query
const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log only for long-running queries
    if (duration > 100) {
      console.log('Executed query:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('Database query error:', error.message);
    console.error('Query:');
    console.error(text);
    console.error('Params:', params);
    console.error('Duration:', duration, 'ms');
    throw error;
  }
};

// Disconnect from database
const disconnect = async () => {
  if (pool) {
    await pool.end();
    console.log('Database disconnected at:', new Date().toISOString());
    pool = null;
    hasConnection = false;
    return true;
  }
  return false;
};

module.exports = {
  query,
  hasConnection,
  connect,
  disconnect,
  testConnection
};
