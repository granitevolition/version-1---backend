/**
 * Direct browser-like proxy for accessing the external humanization API
 * Using Node's built-in https module instead of axios to rule out library issues
 */
const https = require('https');
const http = require('http');
const URL = require('url').URL;

/**
 * Make a direct HTTP(S) request with browser-like behavior
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Response data
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    // Determine whether to use http or https based on the URL
    const protocol = options.url.startsWith('https') ? https : http;
    const url = new URL(options.url);
    
    // Configure request options to mimic a browser
    const requestOptions = {
      method: options.method || 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        ...options.headers
      }
    };
    
    // Log the full request for debugging
    console.log('Making direct request to:', options.url);
    console.log('Request options:', JSON.stringify(requestOptions, null, 2));
    
    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      // Log the response headers for debugging
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Check if the response is JSON
          if (res.headers['content-type'] && 
              res.headers['content-type'].includes('application/json')) {
            resolve(JSON.parse(data));
          } else {
            // Try to parse as JSON anyway, but catch errors
            try {
              const parsedData = JSON.parse(data);
              resolve(parsedData);
            } catch (e) {
              // Not JSON, return as string
              resolve(data);
            }
          }
        } catch (e) {
          console.error('Error parsing response:', e);
          reject(new Error(`Error parsing response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    // Add timeout
    req.setTimeout(options.timeout || 30000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    // Send request body if present
    if (options.data) {
      const body = typeof options.data === 'string' 
        ? options.data 
        : JSON.stringify(options.data);
      
      // Update Content-Length header
      req.setHeader('Content-Length', Buffer.byteLength(body));
      req.write(body);
    }
    
    req.end();
  });
}

/**
 * Directly access the humanization API with browser-like behavior
 * @param {string} text - Text to humanize
 * @returns {Promise<string>} - Humanized text
 */
async function directHumanize(text) {
  try {
    // Use the built-in Node.js http/https libraries instead of axios
    const url = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    // First, try a simple fetch request
    const response = await makeRequest({
      url,
      method: 'POST',
      timeout: 60000,
      data: { text },
      headers: {
        'Origin': 'https://web-production-3db6c.up.railway.app',
        'Referer': 'https://web-production-3db6c.up.railway.app/',
      }
    });
    
    // Check if response is HTML by looking for common HTML tags
    if (typeof response === 'string' && (
        response.includes('<html') || 
        response.includes('<!DOCTYPE') || 
        response.includes('User Registration'))) {
      throw new Error('Received HTML response instead of humanized text');
    }
    
    // Handle various response formats
    if (typeof response === 'string') {
      return response;
    } else if (typeof response === 'object') {
      if (response.humanized_text) return response.humanized_text;
      if (response.result) return response.result;
      if (response.text) return response.text;
      
      // If we get here, just stringify the response
      return JSON.stringify(response);
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Direct humanize error:', error);
    throw error;
  }
}

module.exports = { directHumanize };
