const axios = require('axios');

/**
 * Sends text to the external humanizing API and returns the humanized content
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('[HUMANIZE] Processing request with text length:', text.length);
    
    // API endpoint
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    console.log(`[HUMANIZE] Sending request to ${apiEndpoint}`);
    
    // Try multiple approaches to access the API
    const approaches = [
      // Approach 1: Standard request with browser headers
      {
        name: 'standard',
        method: 'post',
        url: apiEndpoint,
        data: { text },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 30000
      },
      // Approach 2: URL-encoded form data 
      {
        name: 'form-urlencoded',
        method: 'post',
        url: apiEndpoint,
        data: new URLSearchParams({ text }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 30000
      },
      // Approach 3: Raw text with text/plain
      {
        name: 'plaintext',
        method: 'post',
        url: apiEndpoint,
        data: JSON.stringify({ text }),
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000
      },
      // Approach 4: Direct GET request with query parameters
      {
        name: 'get-request',
        method: 'get',
        url: `${apiEndpoint}?text=${encodeURIComponent(text)}`,
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000
      }
    ];
    
    let response = null;
    let lastError = null;
    
    // Try each approach until one works
    for (const config of approaches) {
      try {
        console.log(`[HUMANIZE] Trying ${config.name} approach`);
        response = await axios(config);
        
        console.log(`[HUMANIZE] ${config.name} approach successful, status:`, response.status);
        console.log(`[HUMANIZE] Response content type:`, response.headers['content-type']);
        
        // Check if the response looks like HTML
        if (typeof response.data === 'string' && 
            (response.data.includes('<html') || 
             response.data.includes('<!DOCTYPE') || 
             response.data.includes('User Registration'))) {
          
          console.log(`[HUMANIZE] ${config.name} approach returned HTML, trying next approach`);
          continue; // Skip this response and try the next approach
        }
        
        // If we got here, we have a valid non-HTML response
        break;
      } catch (error) {
        console.log(`[HUMANIZE] ${config.name} approach failed:`, error.message);
        lastError = error;
      }
    }
    
    // Check if any approach succeeded
    if (!response) {
      throw lastError || new Error('All API access approaches failed');
    }
    
    // Process the successful response
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
    
    if (error.response) {
      console.error('[HUMANIZE] API response status:', error.response.status);
      console.error('[HUMANIZE] API response data:', typeof error.response.data === 'string' 
        ? error.response.data.substring(0, 200) 
        : JSON.stringify(error.response.data).substring(0, 200));
    }
    
    throw error;
  }
};

/**
 * Function for testing the API connection
 * This is only used for diagnostics and should not be exposed directly to users
 */
const testHumanizeAPI = async (text) => {
  try {
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`[TEST] Testing API connection to ${apiEndpoint}`);
    
    // Use the same browser-like headers for consistency
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text }, // IMPORTANT: The external API expects "text" not "content"
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    // Check if the response contains HTML
    const containsHtml = typeof response.data === 'string' && 
                         (response.data.includes('<html') || 
                          response.data.includes('<!DOCTYPE') ||
                          response.data.includes('User Registration'));
    
    return {
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
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data ? error.response.data.substring(0, 300) : null
      } : null
    };
  }
};

module.exports = { humanizeText, testHumanizeAPI };
