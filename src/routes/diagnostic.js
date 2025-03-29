const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const { testHumanizeAPI } = require('../utils/humanize');
const { puppeteerHumanize } = require('../utils/puppeteerProxy');
const { formHumanize } = require('../utils/formHumanize');
const { humanizeText } = require('../utils/humanize');
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
                 (SELECT COUNT(*) FROM information_schema.columns 
                  WHERE table_name = t.table_name) as column_count
          FROM information_schema.tables t
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
      JWT_SECRET: process.env.JWT_SECRET ? '[exists]' : 'not set',
      PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH ? '[exists]' : 'not set'
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
 * Emergency test endpoint that directly humanizes text with local fallback
 * Can be used to verify if the system works in emergency situations
 */
router.post('/emergency-test', async (req, res) => {
  try {
    const { text = 'Once upon a time, there was a magical kingdom where everyone lived happily.' } = req.body;
    
    console.log('Running emergency test with text:', text);
    const result = await humanizeText(text);
    
    return res.status(200).json({
      success: true,
      original: text,
      humanized: result,
      note: "This emergency endpoint always uses local fallback if needed"
    });
  } catch (error) {
    console.error('Emergency test failed:', error);
    return res.status(500).json({
      error: 'Emergency test failed',
      message: error.message
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
 * Endpoint to test only the form-based approach
 * Restricted to authenticated users
 */
router.get('/test-form', authenticateToken, async (req, res) => {
  try {
    console.log('Testing form-based approach');
    const text = 'This is a test of the form-based approach.';
    
    const startTime = Date.now();
    const result = await formHumanize(text);
    const duration = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      approach: 'form',
      duration: `${duration}ms`,
      result
    });
  } catch (error) {
    console.error('Form-based test error:', error);
    return res.status(500).json({
      error: 'Form-based test failed',
      message: error.message
    });
  }
});

/**
 * Comprehensive API connection test that tries all known methods
 * This checks what's different between browser and server access
 */
router.get('/api-headers-test', authenticateToken, async (req, res) => {
  try {
    const results = [];
    
    // Test 1: Simple GET request to the main page
    try {
      console.log('Testing GET request to main page');
      const mainPageResponse = await axios.get('https://web-production-3db6c.up.railway.app/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        maxRedirects: 5,
        timeout: 10000
      });
      
      // Extract cookies if any
      const cookies = mainPageResponse.headers['set-cookie'];
      
      results.push({
        attempt: 'get-main-page',
        success: true,
        status: mainPageResponse.status,
        cookies: cookies ? true : false,
        cookieCount: cookies ? cookies.length : 0,
        contentType: mainPageResponse.headers['content-type'],
        isHtml: typeof mainPageResponse.data === 'string' && 
                mainPageResponse.data.includes('<html')
      });
    } catch (error) {
      results.push({
        attempt: 'get-main-page',
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null
      });
    }
    
    // Test 2: JSON POST request
    try {
      console.log('Testing JSON POST request');
      const jsonResponse = await axios.post(
        'https://web-production-3db6c.up.railway.app/humanize_text',
        { text: 'This is a test.' },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://web-production-3db6c.up.railway.app',
            'Referer': 'https://web-production-3db6c.up.railway.app/'
          },
          timeout: 10000,
          maxRedirects: 5
        }
      );
      
      results.push({
        attempt: 'json-post',
        success: true,
        status: jsonResponse.status,
        contentType: jsonResponse.headers['content-type'],
        responseType: typeof jsonResponse.data,
        isHtml: typeof jsonResponse.data === 'string' && 
                (jsonResponse.data.includes('<html') || 
                 jsonResponse.data.includes('User Registration')),
        sample: typeof jsonResponse.data === 'string' 
                ? jsonResponse.data.substring(0, 100) 
                : JSON.stringify(jsonResponse.data).substring(0, 100)
      });
    } catch (error) {
      results.push({
        attempt: 'json-post',
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        isHtml: error.response && typeof error.response.data === 'string' && 
                (error.response.data.includes('<html') || 
                 error.response.data.includes('User Registration'))
      });
    }
    
    // Test 3: Form data POST request
    try {
      console.log('Testing Form Data POST request');
      
      const formData = new FormData();
      formData.append('text', 'This is a test.');
      
      const formResponse = await axios.post(
        'https://web-production-3db6c.up.railway.app/humanize_text',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://web-production-3db6c.up.railway.app',
            'Referer': 'https://web-production-3db6c.up.railway.app/'
          },
          timeout: 10000,
          maxRedirects: 5
        }
      );
      
      results.push({
        attempt: 'form-data-post',
        success: true,
        status: formResponse.status,
        contentType: formResponse.headers['content-type'],
        responseType: typeof formResponse.data,
        isHtml: typeof formResponse.data === 'string' && 
                (formResponse.data.includes('<html') || 
                 formResponse.data.includes('User Registration')),
        sample: typeof formResponse.data === 'string' 
                ? formResponse.data.substring(0, 100) 
                : JSON.stringify(formResponse.data).substring(0, 100)
      });
    } catch (error) {
      results.push({
        attempt: 'form-data-post',
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        isHtml: error.response && typeof error.response.data === 'string' && 
                (error.response.data.includes('<html') || 
                 error.response.data.includes('User Registration'))
      });
    }
    
    // Test 4: URL encoded form POST request
    try {
      console.log('Testing URL encoded form POST request');
      
      const params = new URLSearchParams();
      params.append('text', 'This is a test.');
      
      const urlEncodedResponse = await axios.post(
        'https://web-production-3db6c.up.railway.app/humanize_text',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://web-production-3db6c.up.railway.app',
            'Referer': 'https://web-production-3db6c.up.railway.app/'
          },
          timeout: 10000,
          maxRedirects: 5
        }
      );
      
      results.push({
        attempt: 'url-encoded-post',
        success: true,
        status: urlEncodedResponse.status,
        contentType: urlEncodedResponse.headers['content-type'],
        responseType: typeof urlEncodedResponse.data,
        isHtml: typeof urlEncodedResponse.data === 'string' && 
                (urlEncodedResponse.data.includes('<html') || 
                 urlEncodedResponse.data.includes('User Registration')),
        sample: typeof urlEncodedResponse.data === 'string' 
                ? urlEncodedResponse.data.substring(0, 100) 
                : JSON.stringify(urlEncodedResponse.data).substring(0, 100)
      });
    } catch (error) {
      results.push({
        attempt: 'url-encoded-post',
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        isHtml: error.response && typeof error.response.data === 'string' && 
                (error.response.data.includes('<html') || 
                 error.response.data.includes('User Registration'))
      });
    }
    
    // Test 5: Session-based sequence (get main page with cookies, then post with cookies)
    try {
      console.log('Testing session-based sequence');
      
      // First get the main page to establish a session
      const sessionPageResponse = await axios.get('https://web-production-3db6c.up.railway.app/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        maxRedirects: 5,
        timeout: 10000
      });
      
      // Extract cookies
      const cookies = sessionPageResponse.headers['set-cookie'];
      const cookieHeader = cookies ? cookies.join('; ') : '';
      
      // Make the API call with cookies
      const sessionApiResponse = await axios.post(
        'https://web-production-3db6c.up.railway.app/humanize_text',
        { text: 'This is a test.' },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://web-production-3db6c.up.railway.app',
            'Referer': 'https://web-production-3db6c.up.railway.app/',
            'Cookie': cookieHeader
          },
          timeout: 10000,
          maxRedirects: 5
        }
      );
      
      results.push({
        attempt: 'session-based',
        success: true,
        hasCookies: cookies ? true : false,
        cookieCount: cookies ? cookies.length : 0,
        status: sessionApiResponse.status,
        contentType: sessionApiResponse.headers['content-type'],
        responseType: typeof sessionApiResponse.data,
        isHtml: typeof sessionApiResponse.data === 'string' && 
                (sessionApiResponse.data.includes('<html') || 
                 sessionApiResponse.data.includes('User Registration')),
        sample: typeof sessionApiResponse.data === 'string' 
                ? sessionApiResponse.data.substring(0, 100) 
                : JSON.stringify(sessionApiResponse.data).substring(0, 100)
      });
    } catch (error) {
      results.push({
        attempt: 'session-based',
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        isHtml: error.response && typeof error.response.data === 'string' && 
                (error.response.data.includes('<html') || 
                 error.response.data.includes('User Registration'))
      });
    }
    
    // Test 6: Exact browser headers test
    try {
      console.log('Testing with exact browser headers');
      
      const exactBrowserResponse = await axios({
        method: 'post',
        url: 'https://web-production-3db6c.up.railway.app/humanize_text',
        data: { text: 'This is a test with exact browser headers.' },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Origin': 'https://web-production-3db6c.up.railway.app',
          'Referer': 'https://web-production-3db6c.up.railway.app/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000,
        validateStatus: () => true,
        maxRedirects: 0
      });
      
      results.push({
        attempt: 'exact-browser-headers',
        success: true,
        status: exactBrowserResponse.status,
        contentType: exactBrowserResponse.headers['content-type'],
        responseType: typeof exactBrowserResponse.data,
        isHtml: typeof exactBrowserResponse.data === 'string' && 
                (exactBrowserResponse.data.includes('<html') || 
                 exactBrowserResponse.data.includes('User Registration')),
        sample: typeof exactBrowserResponse.data === 'string' 
                ? exactBrowserResponse.data.substring(0, 100) 
                : JSON.stringify(exactBrowserResponse.data).substring(0, 100)
      });
    } catch (error) {
      results.push({
        attempt: 'exact-browser-headers',
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        isHtml: error.response && typeof error.response.data === 'string' && 
                (error.response.data.includes('<html') || 
                 error.response.data.includes('User Registration'))
      });
    }
    
    // Test 7: Try the real humanizeText function
    try {
      console.log('Testing actual humanizeText function');
      
      const humanizedResult = await humanizeText('This is a test of the actual humanizeText function.');
      
      results.push({
        attempt: 'humanize-text-function',
        success: true,
        isHtml: typeof humanizedResult === 'string' && 
                (humanizedResult.includes('<html') || 
                 humanizedResult.includes('User Registration')),
        result: humanizedResult.substring(0, 100) + (humanizedResult.length > 100 ? '...' : ''),
        usedFallback: humanizedResult.includes('[FALLBACK MODE]')
      });
    } catch (error) {
      results.push({
        attempt: 'humanize-text-function',
        success: false,
        error: error.message
      });
    }
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      testResults: results,
      summary: {
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
        htmlResponses: results.filter(r => r.isHtml).length,
        fallbackUsed: results.some(r => r.success && r.usedFallback)
      }
    });
  } catch (error) {
    console.error('API headers test error:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
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
