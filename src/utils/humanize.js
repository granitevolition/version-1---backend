const axios = require('axios');
const { directHumanize } = require('./humanizeProxy');
const { puppeteerHumanize } = require('./puppeteerProxy');
const { formHumanize } = require('./formHumanize');

/**
 * Sends text to the external humanizing API and returns the humanized content
 * Uses multiple approaches with fallbacks for maximum reliability
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('[HUMANIZE] Processing request with text length:', text.length);
    
    // Store errors for diagnostic purposes
    const errors = [];
    
    // First try the form-based approach (new approach with cookie support)
    try {
      console.log('[HUMANIZE] Attempting form-based approach with cookie support');
      const result = await formHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Form-based approach successful');
        return result;
      }
    } catch (formError) {
      console.error('[HUMANIZE] Form-based approach failed:', formError.message);
      errors.push({ approach: 'form', error: formError.message });
      // Continue to fallback methods
    }
    
    // Next try the Puppeteer approach - the most reliable since it uses an actual browser engine
    try {
      console.log('[HUMANIZE] Attempting Puppeteer browser approach');
      const result = await puppeteerHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Puppeteer browser successful');
        return result;
      }
    } catch (puppeteerError) {
      console.error('[HUMANIZE] Puppeteer browser failed:', puppeteerError.message);
      errors.push({ approach: 'puppeteer', error: puppeteerError.message });
      // Continue to fallback methods
    }
    
    // Then try the direct browser-like proxy implementation
    try {
      console.log('[HUMANIZE] Attempting direct browser-like proxy approach');
      const result = await directHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Direct proxy successful');
        return result;
      }
    } catch (directError) {
      console.error('[HUMANIZE] Direct proxy failed:', directError.message);
      errors.push({ approach: 'direct', error: directError.message });
      // Continue to fallback methods
    }
    
    // Last resort: Try the CORS proxy approach
    console.log('[HUMANIZE] Trying CORS proxy approach as last resort');
    
    // Use a public CORS proxy service
    const proxyUrl = 'https://corsproxy.io/?';
    const targetUrl = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    const response = await axios({
      method: 'post',
      url: proxyUrl + encodeURIComponent(targetUrl),
      data: { text },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 30000,
      validateStatus: () => true, // Accept any status code to handle errors manually
      maxRedirects: 5
    });
    
    console.log('[HUMANIZE] CORS proxy approach response status:', response.status);
    
    // Check for HTML content in string responses
    if (typeof response.data === 'string' && (
        response.data.includes('<html') || 
        response.data.includes('<!DOCTYPE') || 
        response.data.includes('User Registration'))) {
      console.error('[HUMANIZE] API returned HTML instead of humanized text');
      errors.push({ approach: 'cors-proxy', error: 'API returned HTML page' });
      throw new Error('All API access approaches failed. Please see server logs for details.');
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
    console.error('[HUMANIZE] All approaches failed:', error.message);
    throw error;
  }
};

/**
 * Function for testing the API connection
 * This is only used for diagnostics
 */
const testHumanizeAPI = async (text) => {
  const results = {};
  
  // Test form approach
  try {
    console.log('[TEST] Attempting form-based approach');
    const formResult = await formHumanize(text);
    results.form = {
      success: true,
      result: formResult,
      preview: formResult ? formResult.substring(0, 100) + '...' : null
    };
  } catch (formError) {
    console.error('[TEST] Form-based approach failed:', formError.message);
    results.form = {
      success: false,
      error: formError.message
    };
  }
  
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
  
  // Test CORS proxy approach
  try {
    const proxyUrl = 'https://corsproxy.io/?';
    const targetUrl = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`[TEST] Testing CORS proxy approach to ${targetUrl}`);
    
    const response = await axios({
      method: 'post',
      url: proxyUrl + encodeURIComponent(targetUrl),
      data: { text },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000,
      maxRedirects: 5
    });
    
    // Check if the response contains HTML
    const containsHtml = typeof response.data === 'string' && (
      response.data.includes('<html') || 
      response.data.includes('<!DOCTYPE') ||
      response.data.includes('User Registration'));
    
    results.corsProxy = {
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
    console.error('[TEST] CORS proxy approach failed:', error.message);
    results.corsProxy = {
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
