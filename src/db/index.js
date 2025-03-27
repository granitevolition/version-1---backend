const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let _hasConnection = false;

// Initialize the database connection pool
const createPool = () => {
  // Get the database URL from the environment variable - prioritize PUBLIC_URL since it's more likely to work from containers
  const databaseUrl = process.env.DATABASE_PUBLIC_URL || 
                     process.env.DATABASE_URL || 
                     process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    console.error('No database URL provided. Set DATABASE_PUBLIC_URL, DATABASE_URL, or POSTGRES_URL environment variable.');
    return null;
  }
  
  // Log the connection string (with password redacted)
  const redactedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('Connecting to database using:', redactedUrl);
  
  try {
    return new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // maximum number of clients the pool should contain
      idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: 5000, // how long to wait before timing out when connecting a new client
    });
  } catch (error) {
    console.error('Error creating database pool:', error);
    return null;
  }
};

// Check if connection works
const testConnection = async () => {
  if (!pool) {
    console.error('Database pool not initialized');
    _hasConnection = false;
    return false;
  }
  
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      _hasConnection = true;
      console.log('Successfully connected to database at:', result.rows[0].now);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection test failed:', error);
    _hasConnection = false;
    return false;
  }
};

// Connect to database
const connect = async () => {
  try {
    if (!pool) {
      pool = createPool();
      if (!pool) {
        _hasConnection = false;
        return false;
      }
    }
    
    const success = await testConnection();
    _hasConnection = success;
    
    if (success) {
      console.log('Database connected successfully at:', new Date().toISOString());
    } else {
      console.error('Database connection failed at:', new Date().toISOString());
      
      // Try re-creating the pool with a different connection string priority
      if (pool) {
        try {
          await pool.end();
        } catch (err) {
          console.error('Error ending pool:', err);
        }
      }
      
      // If DATABASE_URL failed, try with DATABASE_PUBLIC_URL explicitly
      if (process.env.DATABASE_PUBLIC_URL && process.env.DATABASE_URL !== process.env.DATABASE_PUBLIC_URL) {
        console.log('Trying connection with DATABASE_PUBLIC_URL instead...');
        const redactedUrl = process.env.DATABASE_PUBLIC_URL.replace(/:([^:@]+)@/, ':****@');
        console.log('Connecting to:', redactedUrl);
        
        try {
          pool = new Pool({
            connectionString: process.env.DATABASE_PUBLIC_URL,
            ssl: { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          });
          
          const retrySuccess = await testConnection();
          _hasConnection = retrySuccess;
          
          if (retrySuccess) {
            console.log('Database connection successful with DATABASE_PUBLIC_URL at:', new Date().toISOString());
            return true;
          }
        } catch (publicUrlError) {
          console.error('Error with DATABASE_PUBLIC_URL connection:', publicUrlError);
        }
      }
      
      console.error('Database connection failed after retry at:', new Date().toISOString());
    }
    
    return _hasConnection;
  } catch (error) {
    console.error('Database connection error:', error);
    _hasConnection = false;
    return false;
  }
};

// Execute a query
const query = async (text, params) => {
  if (!pool) {
    pool = createPool();
    if (!pool) {
      throw new Error('Database pool not initialized and could not be created');
    }
    await testConnection();
  }
  
  // Check connection state
  if (!_hasConnection) {
    const reconnected = await testConnection();
    if (!reconnected) {
      throw new Error('Database connection is not available');
    }
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
    _hasConnection = false;
    return true;
  }
  return false;
};

// Run the connection test immediately
testConnection()
  .then(success => {
    console.log('Initial database connection test:', success ? 'SUCCESS' : 'FAILED');
  })
  .catch(error => {
    console.error('Error during initial database connection test:', error);
  });

// Schedule periodic connection checks
setInterval(async () => {
  try {
    const success = await testConnection();
    _hasConnection = success;
    console.log(`Periodic connection check: ${success ? 'Connected' : 'Disconnected'}`);
  } catch (error) {
    console.error('Error during periodic connection check:', error);
    _hasConnection = false;
  }
}, 60000); // Check every minute

module.exports = {
  query,
  get hasConnection() { 
    return _hasConnection; 
  },
  connect,
  disconnect,
  testConnection
};
