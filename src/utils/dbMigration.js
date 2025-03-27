/**
 * Database migration utilities to safely upgrade schema
 */
const db = require('../db');

/**
 * Run database migrations
 * This function safely adds new columns and tables without breaking existing data
 */
const runMigrations = async () => {
  try {
    console.log('Running database migrations...');

    // First check if users table exists
    const userTableExists = await checkTableExists('users');
    
    if (!userTableExists) {
      // Create users table from scratch with all columns
      await db.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          phone VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX idx_users_username ON users(username);
      `);
      console.log('Created users table with full schema');
    } else {
      // Table exists, check for and add missing columns
      await addColumnIfNotExists('users', 'email', 'VARCHAR(255) UNIQUE');
      await addColumnIfNotExists('users', 'phone', 'VARCHAR(20)');
      await addColumnIfNotExists('users', 'last_login', 'TIMESTAMP WITH TIME ZONE');
      
      // Add index on email if it doesn't exist
      await addIndexIfNotExists('users', 'idx_users_email', 'email');
    }
    
    // Now check for sessions table
    const sessionsTableExists = await checkTableExists('user_sessions');
    
    if (!sessionsTableExists) {
      // Create sessions table
      await db.query(`
        CREATE TABLE user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(45),
          user_agent TEXT,
          CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
      `);
      console.log('Created user_sessions table');
    }
    
    console.log('Database migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migrations:', error);
    return false;
  }
};

/**
 * Check if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - True if table exists
 */
const checkTableExists = async (tableName) => {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  
  return result.rows[0].exists;
};

/**
 * Add a column to a table if it doesn't already exist
 * @param {string} tableName - Table to add column to
 * @param {string} columnName - Name of column to add
 * @param {string} columnType - SQL type definition
 */
const addColumnIfNotExists = async (tableName, columnName, columnType) => {
  // Check if the column exists
  const columnExists = await checkColumnExists(tableName, columnName);
  
  if (!columnExists) {
    // Add the column
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
    console.log(`Added ${columnName} column to ${tableName} table`);
  } else {
    console.log(`Column ${columnName} already exists in ${tableName} table`);
  }
};

/**
 * Check if a column exists in a table
 * @param {string} tableName - Table to check
 * @param {string} columnName - Column name to check for
 * @returns {Promise<boolean>} - True if column exists
 */
const checkColumnExists = async (tableName, columnName) => {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT 
        FROM information_schema.columns 
      WHERE 
        table_schema = 'public' AND 
        table_name = $1 AND 
        column_name = $2
    );
  `, [tableName, columnName]);
  
  return result.rows[0].exists;
};

/**
 * Add an index if it doesn't exist
 * @param {string} tableName - Table to add index to
 * @param {string} indexName - Name of the index
 * @param {string} columnName - Column to index
 */
const addIndexIfNotExists = async (tableName, indexName, columnName) => {
  // Check if index exists
  const indexExists = await checkIndexExists(indexName);
  
  if (!indexExists) {
    // Add the index
    await db.query(`CREATE INDEX ${indexName} ON ${tableName}(${columnName});`);
    console.log(`Added index ${indexName} on ${tableName}.${columnName}`);
  } else {
    console.log(`Index ${indexName} already exists`);
  }
};

/**
 * Check if an index exists
 * @param {string} indexName - Name of index to check
 * @returns {Promise<boolean>} - True if index exists
 */
const checkIndexExists = async (indexName) => {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT FROM pg_indexes
      WHERE indexname = $1
    );
  `, [indexName]);
  
  return result.rows[0].exists;
};

module.exports = {
  runMigrations
};
