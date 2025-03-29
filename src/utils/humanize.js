const axios = require('axios');

/**
 * Sanitizes HTML content to plain text
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized plain text
 */
const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  // Check if this looks like HTML
  if (html.includes('<html') || html.includes('<!doctype') || 
      (html.includes('<') && html.includes('>') && 
       (html.includes('<div') || html.includes('<p') || html.includes('<body')))) {
    
    console.log('Detected HTML content, sanitizing...');
    
    // Simple HTML tag removal (basic sanitization)
    return html
      .replace(/<[^>]*>/g, ' ')  // Replace tags with spaces
      .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
      .trim();                   // Trim extra spaces
  }
  
  return html;
};

/**
 * Sends text to the external humanizing API and returns the humanized content
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
    
    // Make a direct axios post request with detailed logging
    console.log(`Sending request to ${apiEndpoint}`);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain, application/json, */*'
      },
      timeout: 15000, // 15 second timeout
      validateStatus: status => status < 500 // Accept any status < 500 to handle API errors better
    });
    
    console.log('External API response status:', response.status);
    console.log('External API response type:', typeof response.data);
    
    // If the API returned an error status
    if (response.status >= 400) {
      console.error('API returned error status:', response.status);
      throw new Error(`External API returned error status: ${response.status}`);
    }
    
    // Handle empty response
    if (!response.data) {
      console.error('API returned empty response');
      throw new Error('External API returned empty response');
    }
    
    // Handle string response (this is the expected format)
    if (typeof response.data === 'string') {
      // Check if it's HTML or an error page
      if (response.data.includes('<html') || 
          response.data.includes('<!doctype') || 
          response.data.includes('<body')) {
        console.error('API returned HTML instead of humanized text');
        throw new Error('External API returned HTML instead of humanized text');
      }
      
      // Return the string directly
      return response.data;
    } 
    // Handle object response (alternative format)
    else if (typeof response.data === 'object') {
      // Try to extract humanized text from known response formats
      if (response.data.humanized_text) {
        return response.data.humanized_text;
      } else if (response.data.result) {
        return response.data.result;
      } else if (response.data.text) {
        return response.data.text;
      } else if (response.data.content) {
        return response.data.content;
      } else {
        // If we can't identify the format, log it and throw an error
        console.error('Unknown API response format:', JSON.stringify(response.data).substring(0, 200));
        throw new Error('External API returned unknown format');
      }
    } 
    // Handle unexpected response type
    else {
      console.error('Unexpected response type:', typeof response.data);
      throw new Error(`External API returned unexpected type: ${typeof response.data}`);
    }
  } catch (error) {
    // Enhance error logging
    console.error('Error in humanizeText function:', error.message);
    
    if (error.response) {
      console.error('API response error status:', error.response.status);
      console.error('API response error data:', typeof error.response.data === 'string' 
        ? error.response.data.substring(0, 200) 
        : JSON.stringify(error.response.data).substring(0, 200));
    } else if (error.request) {
      console.error('No response received from API');
    }
    
    // Re-throw with clear message
    throw new Error(error.message || 'Failed to humanize text via external API');
  }
};

// For testing, we'll add a simple function to make a direct request
const testHumanizeAPI = async (text) => {
  try {
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    console.log(`Testing direct API request to ${apiEndpoint}`);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text },
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('Test API status:', response.status);
    console.log('Test API response type:', typeof response.data);
    console.log('Test API response preview:', 
      typeof response.data === 'string' 
        ? response.data.substring(0, 100) 
        : JSON.stringify(response.data).substring(0, 100));
    
    return 'Test completed';
  } catch (error) {
    console.error('Test API error:', error.message);
    return `Test failed: ${error.message}`;
  }
};

module.exports = { humanizeText, testHumanizeAPI };
