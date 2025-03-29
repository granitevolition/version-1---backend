const express = require('express');
const router = express.Router();
const axios = require('axios');
const { testHumanizeAPI } = require('../utils/humanize');

/**
 * Diagnostic API endpoints for testing connectivity and functionality
 */

// Health check endpoint (required for deployment platforms like Railway)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Direct API test with detailed response information
router.get('/direct-api-test', async (req, res) => {
  try {
    // Test text that we know should work
    const testText = "Once upon a time in a bustling city, a curious child named Leo stumbled upon a secret library.";
    
    // Make a direct call to the API with detailed logging
    const apiUrl = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`[DIAGNOSTIC] Testing direct API call to ${apiUrl}`);
    
    // Try various combinations of request headers
    const attempts = [
      // Attempt 1: Browser-like headers with Origin and Referer
      {
        name: "browser-headers",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Origin': 'https://web-production-3db6c.up.railway.app',
          'Referer': 'https://web-production-3db6c.up.railway.app/'
        }
      },
      // Attempt 2: Minimal headers
      {
        name: "minimal-headers",
        headers: {
          'Content-Type': 'application/json'
        }
      },
      // Attempt 3: Content-Type application/x-www-form-urlencoded
      {
        name: "form-encoded",
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0'
        },
        formData: true
      }
    ];
    
    const results = [];
    
    for (const attempt of attempts) {
      try {
        console.log(`[DIAGNOSTIC] Trying ${attempt.name}`);
        
        const config = {
          method: 'post',
          url: apiUrl,
          headers: attempt.headers,
          timeout: 10000,
          maxRedirects: 0
        };
        
        if (attempt.formData) {
          // Use URLSearchParams for form-encoded data
          const params = new URLSearchParams();
          params.append('text', testText);
          config.data = params;
        } else {
          config.data = { text: testText };
        }
        
        const response = await axios(config);
        
        results.push({
          attempt: attempt.name,
          status: response.status,
          contentType: response.headers['content-type'],
          dataType: typeof response.data,
          isHtml: typeof response.data === 'string' && 
                  (response.data.includes('<html') || 
                   response.data.includes('<!DOCTYPE') ||
                   response.data.includes('User Registration')),
          dataPreview: typeof response.data === 'string' 
            ? response.data.substring(0, 200) 
            : JSON.stringify(response.data).substring(0, 200),
          success: true
        });
      } catch (error) {
        results.push({
          attempt: attempt.name,
          error: error.message,
          response: error.response ? {
            status: error.response.status,
            headers: error.response.headers,
            data: typeof error.response.data === 'string'
              ? error.response.data.substring(0, 200)
              : JSON.stringify(error.response.data).substring(0, 200)
          } : null,
          success: false
        });
      }
    }
    
    // Run the standard test function for comparison
    const standardTest = await testHumanizeAPI(testText);
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      apiUrl,
      testText,
      results,
      standardTest
    });
  } catch (error) {
    console.error('[DIAGNOSTIC] Error in direct-api-test:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// Test comprehensive system check
router.get('/system', async (req, res) => {
  const results = {
    server: { status: 'ok', message: 'Server is running' },
    database: { status: 'pending' },
    externalApi: { status: 'pending' }
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
      const testText = "This is a test.";
      
      const response = await axios({
        method: 'post',
        url: apiEndpoint,
        data: { text: testText },
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0' 
        },
        timeout: 5000
      });
      
      const isHtml = typeof response.data === 'string' && 
                    (response.data.includes('<html') || 
                     response.data.includes('User Registration'));
      
      if (isHtml) {
        results.externalApi = { 
          status: 'error', 
          message: 'API returned HTML instead of humanized text',
          contentType: response.headers['content-type'],
          preview: typeof response.data === 'string' 
            ? response.data.substring(0, 200) 
            : null
        };
      } else {
        results.externalApi = { 
          status: 'ok', 
          message: 'External API connectivity check successful',
          contentType: response.headers['content-type'],
          dataType: typeof response.data,
          preview: typeof response.data === 'string' 
            ? response.data.substring(0, 200) 
            : JSON.stringify(response.data).substring(0, 200)
        };
      }
    } catch (apiError) {
      results.externalApi = { 
        status: 'error', 
        message: 'External API connectivity check failed', 
        error: apiError.message,
        response: apiError.response ? {
          status: apiError.response.status,
          headers: apiError.response.headers,
          data: typeof apiError.response.data === 'string'
            ? apiError.response.data.substring(0, 200)
            : JSON.stringify(apiError.response.data).substring(0, 200)
        } : null
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