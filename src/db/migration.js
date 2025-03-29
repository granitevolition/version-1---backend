const db = require('./index');

/**
 * Initialize database tables if they don't exist
 * Will create required tables and add any missing columns
 */
const initializeTables = async () => {
  try {
    console.log('Initializing database tables...');
    
    // Get database connection string for logging (mask password)
    const connectionStr = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
    const maskedConnectionStr = connectionStr.replace(/:[^:]*@/, ':**@');
    console.log('Connecting to database using:', maskedConnectionStr);
    
    // Test database connection
    try {
      const testResult = await db.query('SELECT NOW()');
      console.log('Initial database connection test:', testResult.rows ? 'SUCCESS' : 'FAILED');
    } catch (testError) {
      console.error('Initial database connection test: FAILED');
      console.error('Connection error:', testError.message);
    }
    
    // Check if tables already exist before creating
    const tableExists = await db.query(`
      SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      );
    `);
    
    console.log('Executed query:', {
      text: tableExists.text,
      duration: tableExists.duration,
      rows: tableExists.rowCount
    });
    
    if (tableExists.rows[0].exists) {
      console.log('Tables already exist, checking for missing columns...');
      
      // Get existing columns in users table
      const userColumns = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users';
      `);
      
      console.log('Executed query:', {
        text: userColumns.text,
        duration: userColumns.duration,
        rows: userColumns.rowCount
      });
      
      // Create the humanization_queue table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS humanization_queue (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          original_text TEXT NOT NULL,
          humanized_text TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          error_message TEXT,
          word_count INTEGER NOT NULL DEFAULT 0
        );
      `);
      
      // Create index on status for quick queue processing
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_humanization_queue_status ON humanization_queue(status);
      `);
      
      // Create index on user_id for quick user lookups
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_humanization_queue_user_id ON humanization_queue(user_id);
      `);
      
      console.log('Table migration completed successfully');
      return;
    }
    
    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP WITH TIME ZONE
      );
    `);
    
    // Create subscriptions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plan_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        payment_method VARCHAR(50),
        payment_id VARCHAR(255),
        UNIQUE(user_id)
      );
    `);
    
    // Create humanize_usage table
    await db.query(`
      CREATE TABLE IF NOT EXISTS humanize_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        word_count INTEGER NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create humanization_queue table
    await db.query(`
      CREATE TABLE IF NOT EXISTS humanization_queue (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_text TEXT NOT NULL,
        humanized_text TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        word_count INTEGER NOT NULL DEFAULT 0
      );
    `);
    
    // Create indices for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_humanization_queue_status ON humanization_queue(status);
      CREATE INDEX IF NOT EXISTS idx_humanization_queue_user_id ON humanization_queue(user_id);
    `);
    
    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
};

module.exports = { initializeTables };
