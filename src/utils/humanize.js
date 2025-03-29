const axios = require('axios');
const { directHumanize } = require('./humanizeProxy');

/**
 * Sends text to the external humanizing API and returns the humanized content
 * Now using the direct browser-like proxy as the primary method
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('[HUMANIZE] Processing request with text length:', text.length);
    
    // First try the direct browser-like proxy implementation
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
    
    // Fallback to a simplified axios request if the direct approach fails
    console.log('[HUMANIZE] Falling back to simplified axios approach');
    
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://web-production-3db6c.up.railway.app',
        'Referer': 'https://web-production-3db6c.up.railway.app/'
      },
      timeout: 30000,
      validateStatus: () => true // Accept any status code to handle errors manually
    });
    
    console.log('[HUMANIZE] Axios response status:', response.status);
    
    // Check for HTML content in string responses
    if (typeof response.data === 'string' && (
        response.data.includes('<html') || 
        response.data.includes('<!DOCTYPE') || 
        response.data.includes('User Registration'))) {
      console.error('[HUMANIZE] API returned HTML instead of humanized text');
      throw new Error('API returned HTML page instead of humanized text');
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
  try {
    // First try the direct browser-like implementation
    console.log('[TEST] Attempting direct browser implementation');
    try {
      const directResult = await directHumanize(text);
      return {
        method: 'direct-node-https',
        success: true,
        result: directResult
      };
    } catch (directError) {
      console.error('[TEST] Direct implementation failed:', directError.message);
    }
    
    // Fall back to axios
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`[TEST] Testing API connection to ${apiEndpoint}`);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text },
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    
    // Check if the response contains HTML
    const containsHtml = typeof response.data === 'string' && (
      response.data.includes('<html') || 
      response.data.includes('<!DOCTYPE') ||
      response.data.includes('User Registration'));
    
    return {
      method: 'axios',
      status: response.status,
      contentType: response.headers['content-type'],
      type: typeof response.data,
      containsHtml,
      preview: typeof response.data === 'string' 
        ? response.data.substring(0, 300) 
        : JSON.stringify(response.data).substring(0, 300)
    };
  } catch (error) {
    console.error('[TEST] API test error:', error.message);
    return {
      method: 'axios',
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data ? error.response.data.substring(0, 300) : null
      } : null
    };
  }
};

module.exports = { humanizeText, testHumanizeAPI };
