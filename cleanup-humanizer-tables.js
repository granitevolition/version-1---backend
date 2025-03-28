/**
 * This script removes all humanizer-related tables from the Railway PostgreSQL database
 * Run with: node cleanup-humanizer-tables.js
 */

const { Client } = require('pg');

async function cleanupHumanizerTables() {
  // Railway provides connection strings as environment variables
  const connectionString = process.env.DATABASE_URL || 
                         process.env.DATABASE_PUBLIC_URL || 
                         process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('Error: No database connection string found. Please check DATABASE_URL, DATABASE_PUBLIC_URL, or POSTGRES_URL environment variables');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Railway Postgres
    }
  });

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to database');

    // Check which humanizer tables exist
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('humanize_logs', 'humanize_usage_statistics', 'humanize_usage_limits');
    `;
    
    const existingTables = await client.query(tableCheckQuery);
    
    if (existingTables.rows.length === 0) {
      console.log('No humanizer tables found in the database.');
      return;
    }
    
    // Log which tables were found
    console.log('Found the following humanizer tables:');
    existingTables.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Begin a transaction for safety
    await client.query('BEGIN');
    
    try {
      // Drop constraints first to avoid foreign key issues
      console.log('Removing foreign key constraints...');
      
      // Identify and drop foreign key constraints
      const constraintQuery = `
        SELECT
          tc.table_name, 
          tc.constraint_name
        FROM 
          information_schema.table_constraints AS tc 
        JOIN 
          information_schema.constraint_column_usage AS ccu
        ON 
          tc.constraint_name = ccu.constraint_name
        WHERE 
          tc.constraint_type = 'FOREIGN KEY' AND
          (tc.table_name LIKE 'humanize%' OR ccu.table_name LIKE 'humanize%');
      `;
      
      const constraints = await client.query(constraintQuery);
      
      for (const constraint of constraints.rows) {
        console.log(`Dropping constraint ${constraint.constraint_name} on table ${constraint.table_name}`);
        await client.query(`ALTER TABLE ${constraint.table_name} DROP CONSTRAINT ${constraint.constraint_name}`);
      }
      
      // Drop tables
      for (const row of existingTables.rows) {
        const tableName = row.table_name;
        console.log(`Dropping table: ${tableName}`);
        await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Successfully removed all humanizer tables');
      
    } catch (error) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error('Error removing tables:', error);
      throw error;
    }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    // Close the connection
    await client.end();
    console.log('Database connection closed');
  }
}

cleanupHumanizerTables().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
