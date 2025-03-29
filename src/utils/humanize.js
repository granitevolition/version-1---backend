const axios = require('axios');

/**
 * Checks if content is HTML
 * @param {string} content - Content to check
 * @returns {boolean} - True if content appears to be HTML
 */
const isHtmlContent = (content) => {
  if (typeof content !== 'string') return false;
  
  // Check for common HTML indicators
  const htmlIndicators = [
    '<html', '</html>',
    '<!doctype', '<!DOCTYPE',
    '<body', '</body>',
    '<div', '<p>',
    'User Registration',
    'enable JavaScript',
    '<script', '</script>'
  ];
  
  return htmlIndicators.some(indicator => content.includes(indicator));
};

/**
 * Sends text to the external humanizing API and returns the humanized content
 * Using browser-like headers to prevent redirects to login pages
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('Calling external humanize API with text:', text.substring(0, 100) + '...');
    
    // API endpoint
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    // Make a direct axios post request with browser-like headers
    console.log(`Sending request to ${apiEndpoint}`);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text }, // IMPORTANT: The external API expects "text" not "content"
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Origin': 'https://web-production-3db6c.up.railway.app',
        'Referer': 'https://web-production-3db6c.up.railway.app/'
      },
      maxRedirects: 0, // Prevent following redirects
      validateStatus: status => status < 400, // Only treat HTTP errors as errors
      timeout: 30000 // 30 second timeout
    });
    
    console.log('External API response status:', response.status);
    console.log('External API response type:', typeof response.data);
    
    // Check for HTML content in string responses
    if (typeof response.data === 'string') {
      if (isHtmlContent(response.data)) {
        console.error('API returned HTML instead of humanized text');
        console.error('HTML snippet:', response.data.substring(0, 200));
        throw new Error('API returned HTML page instead of humanized text');
      }
      
      // If it's not HTML, it's likely the humanized text
      return response.data;
    }
    
    // If the response is a JSON object, extract the result from known fields
    if (typeof response.data === 'object') {
      // Check for error indicators
      if (response.data.error) {
        throw new Error(`API error: ${response.data.error}`);
      }
      
      if (response.data.result) {
        return response.data.result;
      } else if (response.data.humanized_text) {
        return response.data.humanized_text;
      } else {
        // If we can't identify the format, log but don't return raw JSON
        console.warn('Unknown response format:', JSON.stringify(response.data).substring(0, 200));
        throw new Error('Received unexpected format from humanization API');
      }
    }
    
    // If we got here, something unexpected happened
    throw new Error('Unexpected response format from humanization API');
  } catch (error) {
    console.error('Error in humanizeText function:', error.message);
    
    if (error.response) {
      console.error('API response error status:', error.response.status);
      console.error('API response error data:', typeof error.response.data === 'string' 
        ? error.response.data.substring(0, 200) 
        : JSON.stringify(error.response.data).substring(0, 200));
    }
    
    // Rethrow the error for the route handler to catch
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
    console.log(`Testing API connection to ${apiEndpoint}`);
    
    // Use the same browser-like headers for consistency
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text }, // IMPORTANT: The external API expects "text" not "content"
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Origin': 'https://web-production-3db6c.up.railway.app',
        'Referer': 'https://web-production-3db6c.up.railway.app/'
      },
      maxRedirects: 0,
      timeout: 10000
    });
    
    // Check if the response contains HTML
    const containsHtml = typeof response.data === 'string' && isHtmlContent(response.data);
    
    return {
      status: response.status,
      type: typeof response.data,
      containsHtml,
      preview: typeof response.data === 'string' 
        ? response.data.substring(0, 300) 
        : JSON.stringify(response.data).substring(0, 300)
    };
  } catch (error) {
    console.error('Test API error:', error.message);
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
