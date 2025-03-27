const { Pool } = require('pg');

// Create a connection pool to the Postgres database
// First try DATABASE_URL (internal Railway connection)
// Then try DATABASE_PUBLIC_URL (external connection)
// Fall back to POSTGRES_URL (custom)
const connectionString = process.env.DATABASE_URL || 
                         process.env.DATABASE_PUBLIC_URL || 
                         process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('No database connection string found. Please set DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL');
  process.exit(1);
}

const pool = new Pool({
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

module.exports = {
  // Execute a query on the database
  query: (text, params) => pool.query(text, params),
  
  // Get a client from the pool
  getClient: () => pool.connect()
};
