const { Pool } = require('pg');

// Create a connection pool to the Postgres database
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
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
