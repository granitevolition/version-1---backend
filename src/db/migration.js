/**
 * Database migrations
 */
const db = require('./index');

/**
 * Initialize database tables
 */
const initializeTables = async () => {
  try {
    console.log('Initializing database tables...');
    
    // Check if tables exist first
    const tablesExist = await checkTablesExist();
    
    if (tablesExist) {
      console.log('Tables already exist, checking for missing columns...');
      await addMissingColumns();
      return;
    }
    
    // Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        tier VARCHAR(20) DEFAULT 'free',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      
      -- Create user_sessions table for handling login sessions
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

/**
 * Check if the required tables already exist
 */
const checkTablesExist = async () => {
  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking if tables exist:', error);
    return false;
  }
};

/**
 * Add any missing columns to existing tables
 */
const addMissingColumns = async () => {
  try {
    // Get existing columns
    const columns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users';
    `);
    
    const columnNames = columns.rows.map(row => row.column_name);
    
    // Add email column if it doesn't exist
    if (!columnNames.includes('email')) {
      console.log('Adding email column to users table');
      await db.query(`
        ALTER TABLE users
        ADD COLUMN email VARCHAR(255) UNIQUE;
      `);
    }
    
    // Add phone column if it doesn't exist
    if (!columnNames.includes('phone')) {
      console.log('Adding phone column to users table');
      await db.query(`
        ALTER TABLE users
        ADD COLUMN phone VARCHAR(20);
      `);
    }
    
    // Add last_login column if it doesn't exist
    if (!columnNames.includes('last_login')) {
      console.log('Adding last_login column to users table');
      await db.query(`
        ALTER TABLE users
        ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
      `);
    }
    
    // Add tier column if it doesn't exist
    if (!columnNames.includes('tier')) {
      console.log('Adding tier column to users table');
      await db.query(`
        ALTER TABLE users
        ADD COLUMN tier VARCHAR(20) DEFAULT 'free';
      `);
    }
    
    console.log('Table migration completed successfully');
  } catch (error) {
    console.error('Error during column migration:', error);
  }
};

module.exports = {
  initializeTables
};
