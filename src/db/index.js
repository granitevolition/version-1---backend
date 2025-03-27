const { Pool } = require('pg');

// Create a connection pool to the Postgres database
// First try DATABASE_PUBLIC_URL (external connection that should always work)
// Then try DATABASE_URL (internal Railway connection)
// Fall back to POSTGRES_URL (custom)
const connectionString = process.env.DATABASE_PUBLIC_URL || 
                         process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL;

// Dummy pool for when we're running without a database
const dummyPool = {
  query: () => Promise.reject(new Error('No database connection available')),
  connect: () => Promise.reject(new Error('No database connection available'))
};

let pool;

// Only create a real pool if we have a connection string
if (connectionString) {
  try {
    console.log(`Connecting to database using: ${connectionString.replace(/:[^:]*@/, ':****@')}`);
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Railway Postgres
      }
    });

    // Test the database connection
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('Database connection error:', err.message);
      } else {
        console.log('Database connected successfully at:', res.rows[0].now);
      }
    });
  } catch (err) {
    console.error('Failed to create database pool:', err.message);
    pool = dummyPool;
  }
} else {
  console.error('No database connection string found. Using dummy database implementation.');
  pool = dummyPool;
}

// Wrapper with error handling
const safeQuery = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('Database query error:', err.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw err;
  }
};

module.exports = {
  // Execute a query on the database with better error handling
  query: safeQuery,
  
  // Get a client from the pool
  getClient: () => pool.connect(),
  
  // Check if we have a real database connection
  hasConnection: !!connectionString
};
