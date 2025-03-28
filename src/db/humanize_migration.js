/**
 * Migration script to create humanize_usage table for tracking AI humanization usage
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create humanize_usage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS humanize_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        word_count INTEGER NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        content_type VARCHAR(50) DEFAULT 'text',
        is_successful BOOLEAN DEFAULT TRUE
      );
    `);

    // Create index for faster user-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS humanize_usage_user_id_idx ON humanize_usage(user_id);
    `);

    // Create index for time-based analytics
    await client.query(`
      CREATE INDEX IF NOT EXISTS humanize_usage_timestamp_idx ON humanize_usage(timestamp);
    `);

    // Add column to track monthly usage per user
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS monthly_humanize_usage INTEGER DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('Humanize usage tracking tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating humanize usage tracking tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migration()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migration };
