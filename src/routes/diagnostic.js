const express = require('express');
const router = express.Router();
const { testHumanizeAPI } = require('../utils/humanize');
const { puppeteerHumanize } = require('../utils/puppeteerProxy');
const db = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');

/**
 * Health check endpoint
 * Returns information about system status
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    let dbStatus = 'unknown';
    let dbDetails = null;
    
    try {
      const dbResult = await db.query('SELECT 1 as connection_test');
      dbStatus = dbResult && dbResult.rows && dbResult.rows[0] ? 'connected' : 'error';
    } catch (dbError) {
      dbStatus = 'error';
      dbDetails = dbError.message;
    }
    
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      components: {
        database: {
          status: dbStatus,
          details: dbDetails
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * System check endpoint
 * Only accessible to authenticated users - security restriction
 */
router.get('/system', authenticateToken, async (req, res) => {
  try {
    // Check database connectivity
    let dbStatus = 'unknown';
    let dbDetails = null;
    let tablesInfo = null;
    
    try {
      const dbResult = await db.query('SELECT 1 as connection_test');
      dbStatus = dbResult && dbResult.rows && dbResult.rows[0] ? 'connected' : 'error';
      
      // Get table info if connected
      if (dbStatus === 'connected') {
        const tablesResult = await db.query(`
          SELECT table_name, 
                 (SELECT COUNT(*) FROM ${process.env.DB_NAME || 'information_schema'}.columns 
                  WHERE table_name = t.table_name) as column_count
          FROM ${process.env.DB_NAME || 'information_schema'}.tables t
          WHERE table_schema = 'public'
        `);
        
        tablesInfo = tablesResult.rows;
      }
    } catch (dbError) {
      dbStatus = 'error';
      dbDetails = dbError.message;
    }
    
    // Get environment info (omit sensitive data)
    const env = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || 8080,
      DB_HOST: process.env.DB_HOST ? '[redacted]' : 'not set',
      DB_USER: process.env.DB_USER ? '[redacted]' : 'not set',
      DB_NAME: process.env.DB_NAME ? '[redacted]' : 'not set',
      JWT_SECRET: process.env.JWT_SECRET ? '[exists]' : 'not set'
    };
    
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: env,
      components: {
        database: {
          status: dbStatus,
          details: dbDetails,
          tables: tablesInfo
        },
        users: {
          count: await getUserCount()
        },
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          platform: process.platform,
          node: process.version
        }
      }
    });
  } catch (error) {
    console.error('System check error:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Direct API test endpoint
 * This performs a comprehensive test of the external API
 * Restricted to authenticated users only for security
 */
router.get('/direct-api-test', authenticateToken, async (req, res) => {
  try {
    const text = 'This is a test of the humanization API functionality.';
    const result = await testHumanizeAPI(text);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('API test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'error'
    });
  }
});

/**
 * Endpoint to test only the Puppeteer approach
 * Restricted to authenticated users
 */
router.get('/test-puppeteer', authenticateToken, async (req, res) => {
  try {
    console.log('Testing Puppeteer browser-based approach');
    const text = 'This is a test of the Puppeteer browser-based approach.';
    
    const startTime = Date.now();
    const result = await puppeteerHumanize(text);
    const duration = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      approach: 'puppeteer',
      duration: `${duration}ms`,
      result
    });
  } catch (error) {
    console.error('Puppeteer test error:', error);
    return res.status(500).json({
      error: 'Puppeteer test failed',
      message: error.message
    });
  }
});

/**
 * Helper function to get user count
 */
async function getUserCount() {
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM users');
    return result.rows[0].count;
  } catch (error) {
    console.error('Error getting user count:', error);
    return 'error';
  }
}

module.exports = router;
