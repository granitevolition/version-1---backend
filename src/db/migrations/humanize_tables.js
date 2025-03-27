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
    
    // Create the humanize_logs table
    await db.query(`
      CREATE TABLE humanize_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    await db.query(`
      CREATE TABLE humanize_usage_statistics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
    throw error;
  }
}

module.exports = {
  createHumanizeTables
};
