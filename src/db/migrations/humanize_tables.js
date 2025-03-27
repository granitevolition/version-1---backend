/**
 * Database migrations for humanizing functionality
 */
const db = require('../index');

/**
 * Create tables for tracking humanizing functionality usage
 */
async function createHumanizeTables() {
  try {
    console.log('Creating humanize tracking tables...');
    
    // Check if the humanize_logs table already exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'humanize_logs'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('Humanize tables already exist, skipping creation');
      return;
    }
    
    // Check if users table exists before trying to reference it
    const usersExist = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    const usersTableExists = usersExist.rows[0].exists;
    
    // Define the user_id column based on whether users table exists
    const userIdColumn = usersTableExists 
      ? "user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,"
      : "user_id INTEGER,";
      
    // Create the humanize_logs table
    await db.query(`
      CREATE TABLE humanize_logs (
        id SERIAL PRIMARY KEY,
        ${userIdColumn}
        original_text TEXT NOT NULL,
        humanized_text TEXT NOT NULL,
        text_length INTEGER NOT NULL,
        ai_score INTEGER,
        human_score INTEGER,
        ip_address VARCHAR(45),
        user_agent TEXT,
        process_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Index for faster user queries
      CREATE INDEX idx_humanize_logs_user_id ON humanize_logs(user_id);
      
      -- Index for time-based queries
      CREATE INDEX idx_humanize_logs_created_at ON humanize_logs(created_at);
    `);
    
    // Create the humanize_usage_statistics table for aggregated data
    // If users table doesn't exist, create without foreign key constraint
    const userStatsUserIdColumn = usersTableExists
      ? "user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,"
      : "user_id INTEGER,";
      
    await db.query(`
      CREATE TABLE humanize_usage_statistics (
        id SERIAL PRIMARY KEY,
        ${userStatsUserIdColumn}
        total_uses INTEGER DEFAULT 0,
        total_characters INTEGER DEFAULT 0,
        avg_ai_score NUMERIC(5,2) DEFAULT 0,
        last_used_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create unique index on user_id
      CREATE UNIQUE INDEX idx_humanize_usage_user_id ON humanize_usage_statistics(user_id);
    `);
    
    // Create a usage limits table for different user tiers
    await db.query(`
      CREATE TABLE humanize_usage_limits (
        id SERIAL PRIMARY KEY,
        tier_name VARCHAR(50) NOT NULL UNIQUE,
        daily_limit INTEGER NOT NULL,
        max_text_length INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Insert default tiers
      INSERT INTO humanize_usage_limits (tier_name, daily_limit, max_text_length)
      VALUES 
        ('free', 5, 5000),
        ('basic', 20, 10000),
        ('premium', 100, 50000),
        ('unlimited', 1000, 100000);
    `);
    
    console.log('Humanize tables created successfully');
  } catch (error) {
    console.error('Error creating humanize tables:', error);
    // Don't throw the error to allow the server to continue starting
  }
}

/**
 * Fix foreign key constraints on humanize tables if they were created before the users table
 */
async function fixHumanizeTableConstraints() {
  try {
    // Check if users and humanize tables exist
    const [usersExist, humanizeLogsExist, humanizeStatsExist] = await Promise.all([
      db.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');`),
      db.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'humanize_logs');`),
      db.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'humanize_usage_statistics');`)
    ]);
    
    // Only proceed if users table exists but the humanize tables might not have constraints
    if (usersExist.rows[0].exists && (humanizeLogsExist.rows[0].exists || humanizeStatsExist.rows[0].exists)) {
      // Check if foreign key constraints exist
      const constraints = await db.query(`
        SELECT tc.constraint_name, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name = 'humanize_logs' OR tc.table_name = 'humanize_usage_statistics')
        AND kcu.column_name = 'user_id';
      `);
      
      // If constraints don't exist for humanize_logs, add them
      if (humanizeLogsExist.rows[0].exists && !constraints.rows.some(r => r.table_name === 'humanize_logs')) {
        console.log('Adding foreign key constraint to humanize_logs table');
        await db.query(`
          ALTER TABLE humanize_logs
          ADD CONSTRAINT fk_humanize_logs_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        `);
      }
      
      // If constraints don't exist for humanize_usage_statistics, add them
      if (humanizeStatsExist.rows[0].exists && !constraints.rows.some(r => r.table_name === 'humanize_usage_statistics')) {
        console.log('Adding foreign key constraint to humanize_usage_statistics table');
        await db.query(`
          ALTER TABLE humanize_usage_statistics
          ADD CONSTRAINT fk_humanize_usage_stats_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        `);
      }
    }
  } catch (error) {
    console.error('Error fixing humanize table constraints:', error);
  }
}

module.exports = {
  createHumanizeTables,
  fixHumanizeTableConstraints
};
