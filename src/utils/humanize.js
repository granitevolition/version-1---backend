const axios = require('axios');
const { directHumanize } = require('./humanizeProxy');
const { puppeteerHumanize } = require('./puppeteerProxy');

/**
 * Sends text to the external humanizing API and returns the humanized content
 * Now using multiple approaches with fallbacks for maximum reliability
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('[HUMANIZE] Processing request with text length:', text.length);
    
    // First try the Puppeteer approach - the most reliable since it uses an actual browser engine
    try {
      console.log('[HUMANIZE] Attempting Puppeteer browser approach');
      const result = await puppeteerHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Puppeteer browser successful');
        return result;
      }
    } catch (puppeteerError) {
      console.error('[HUMANIZE] Puppeteer browser failed:', puppeteerError.message);
      // Continue to fallback methods
    }
    
    // Next try the direct browser-like proxy implementation
    try {
      console.log('[HUMANIZE] Attempting direct browser-like proxy approach');
      const result = await directHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Direct proxy successful');
        return result;
      }
    } catch (directError) {
      console.error('[HUMANIZE] Direct proxy failed:', directError.message);
      // Continue to fallback methods
    }
    
    // Last resort: Try sending as form data instead of JSON
    console.log('[HUMANIZE] Trying form data approach as last resort');
    
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    // Prepare URLSearchParams
    const params = new URLSearchParams();
    params.append('text', text);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://web-production-3db6c.up.railway.app',
        'Referer': 'https://web-production-3db6c.up.railway.app/'
      },
      timeout: 30000,
      validateStatus: () => true, // Accept any status code to handle errors manually
      maxRedirects: 0 // Do not follow redirects
    });
    
    console.log('[HUMANIZE] Form data approach response status:', response.status);
    
    // Check for HTML content in string responses
    if (typeof response.data === 'string' && (
        response.data.includes('<html') || 
        response.data.includes('<!DOCTYPE') || 
        response.data.includes('User Registration'))) {
      console.error('[HUMANIZE] API returned HTML instead of humanized text');
      throw new Error('Server returned an HTML page. The humanization service may be temporarily unavailable.');
    }
    
    // Process the response based on its type
    if (typeof response.data === 'string') {
      return response.data;
    } else if (typeof response.data === 'object') {
      if (response.data.result) {
        return response.data.result;
      } else if (response.data.humanized_text) {
        return response.data.humanized_text;
      } else {
        console.warn('[HUMANIZE] Unknown response format:', JSON.stringify(response.data).substring(0, 200));
        return JSON.stringify(response.data);
      }
    }
    
    throw new Error('Unexpected response format from humanization API');
  } catch (error) {
    console.error('[HUMANIZE] Error:', error.message);
    throw error;
  }
};

/**
 * Function for testing the API connection
 * This is only used for diagnostics
 */
const testHumanizeAPI = async (text) => {
  const results = {};
  
  // Test puppeteer approach
  try {
    console.log('[TEST] Attempting Puppeteer browser approach');
    const puppeteerResult = await puppeteerHumanize(text);
    results.puppeteer = {
      success: true,
      result: puppeteerResult,
      preview: puppeteerResult ? puppeteerResult.substring(0, 100) + '...' : null
    };
  } catch (puppeteerError) {
    console.error('[TEST] Puppeteer browser approach failed:', puppeteerError.message);
    results.puppeteer = {
      success: false,
      error: puppeteerError.message
    };
  }
  
  // Test direct implementation
  try {
    console.log('[TEST] Attempting direct browser implementation');
    const directResult = await directHumanize(text);
    results.direct = {
      success: true,
      result: directResult,
      preview: directResult ? directResult.substring(0, 100) + '...' : null
    };
  } catch (directError) {
    console.error('[TEST] Direct implementation failed:', directError.message);
    results.direct = {
      success: false,
      error: directError.message
    };
  }
  
  // Test form data approach
  try {
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`[TEST] Testing form data approach to ${apiEndpoint}`);
    
    // Prepare URLSearchParams
    const params = new URLSearchParams();
    params.append('text', text);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: params,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000,
      maxRedirects: 0
    });
    
    // Check if the response contains HTML
    const containsHtml = typeof response.data === 'string' && (
      response.data.includes('<html') || 
      response.data.includes('<!DOCTYPE') ||
      response.data.includes('User Registration'));
    
    results.formData = {
      success: !containsHtml,
      status: response.status,
      contentType: response.headers['content-type'],
      type: typeof response.data,
      containsHtml,
      preview: typeof response.data === 'string' 
        ? response.data.substring(0, 100) + '...' 
        : JSON.stringify(response.data).substring(0, 100) + '...'
    };
  } catch (error) {
    console.error('[TEST] Form data approach failed:', error.message);
    results.formData = {
      success: false,
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data ? error.response.data.substring(0, 100) + '...' : null
      } : null
    };
  }
  
  // Test JSON approach
  try {
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`[TEST] Testing JSON approach to ${apiEndpoint}`);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text },
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000,
      maxRedirects: 0
    });
    
    // Check if the response contains HTML
    const containsHtml = typeof response.data === 'string' && (
      response.data.includes('<html') || 
      response.data.includes('<!DOCTYPE') ||
      response.data.includes('User Registration'));
    
    results.json = {
      success: !containsHtml,
      status: response.status,
      contentType: response.headers['content-type'],
      type: typeof response.data,
      containsHtml,
      preview: typeof response.data === 'string' 
        ? response.data.substring(0, 100) + '...' 
        : JSON.stringify(response.data).substring(0, 100) + '...'
    };
  } catch (error) {
    console.error('[TEST] JSON approach failed:', error.message);
    results.json = {
      success: false,
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data ? error.response.data.substring(0, 100) + '...' : null
      } : null
    };
  }
  
  return {
    timestamp: new Date().toISOString(),
    testText: text,
    results
  };
};

module.exports = { humanizeText, testHumanizeAPI };
