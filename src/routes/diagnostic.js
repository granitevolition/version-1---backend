const express = require('express');
const router = express.Router();
const axios = require('axios');
const { testHumanizeAPI } = require('../utils/humanize');

/**
 * Diagnostic API endpoints for testing connectivity and functionality
 * These endpoints are not protected by authentication to allow troubleshooting
 */

// Health check endpoint (required for deployment platforms like Railway)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test database connection
router.get('/db', async (req, res) => {
  try {
    const db = require('../db');
    const result = await db.query('SELECT NOW() as time');
    res.status(200).json({ 
      status: 'ok', 
      message: 'Database connection successful', 
      time: result.rows[0].time 
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: error.message 
    });
  }
});

// Test external API connectivity
router.get('/api', async (req, res) => {
  try {
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    const response = await axios({
      method: 'get',
      url: apiEndpoint,
      timeout: 5000
    });
    
    res.status(200).json({
      status: 'ok',
      message: 'External API connectivity check successful',
      apiStatus: response.status,
      apiResponse: typeof response.data === 'string' 
        ? response.data.substring(0, 100) + '...' 
        : response.data
    });
  } catch (error) {
    console.error('External API connectivity test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'External API connectivity check failed',
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response'
    });
  }
});

// Test humanization API with sample text
router.get('/humanize', async (req, res) => {
  try {
    const sampleText = 'This is a test of the humanization API. Is it working properly?';
    const result = await testHumanizeAPI(sampleText);
    
    res.status(200).json({
      status: 'ok',
      message: 'Humanization API test successful',
      sampleText,
      testResult: result
    });
  } catch (error) {
    console.error('Humanization API test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Humanization API test failed',
      error: error.message
    });
  }
});

// Test comprehensive system check
router.get('/system', async (req, res) => {
  const results = {
    server: { status: 'ok', message: 'Server is running' },
    database: { status: 'pending' },
    externalApi: { status: 'pending' },
    humanizationApi: { status: 'pending' }
  };
  
  try {
    // Test database
    try {
      const db = require('../db');
      await db.query('SELECT NOW()');
      results.database = { status: 'ok', message: 'Database connection successful' };
    } catch (dbError) {
      results.database = { 
        status: 'error', 
        message: 'Database connection failed', 
        error: dbError.message 
      };
    }
    
    // Test external API connectivity
    try {
      const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
      const response = await axios({
        method: 'get',
        url: apiEndpoint,
        timeout: 5000
      });
      
      results.externalApi = { 
        status: 'ok', 
        message: 'External API connectivity check successful', 
        apiStatus: response.status 
      };
    } catch (apiError) {
      results.externalApi = { 
        status: 'error', 
        message: 'External API connectivity check failed', 
        error: apiError.message 
      };
    }
    
    // Test humanization
    try {
      const sampleText = 'This is a test of the humanization API.';
      const testResult = await testHumanizeAPI(sampleText);
      
      results.humanizationApi = { 
        status: 'ok', 
        message: 'Humanization API test successful',
        received: typeof testResult.fullData === 'string' 
          ? testResult.fullData.substring(0, 100) + '...' 
          : JSON.stringify(testResult.fullData).substring(0, 100) + '...'
      };
    } catch (humanizeError) {
      results.humanizationApi = { 
        status: 'error', 
        message: 'Humanization API test failed', 
        error: humanizeError.message 
      };
    }
    
    // Calculate overall system status
    const statusCounts = Object.values(results).reduce((acc, check) => {
      acc[check.status] = (acc[check.status] || 0) + 1;
      return acc;
    }, {});
    
    const overallStatus = statusCounts.error > 0 ? 'error' : 'ok';
    
    res.status(overallStatus === 'ok' ? 200 : 500).json({
      status: overallStatus,
      message: overallStatus === 'ok' ? 'All systems operational' : 'Some systems are experiencing issues',
      checks: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('System check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'System check failed',
      error: error.message
    });
  }
});

module.exports = router;
