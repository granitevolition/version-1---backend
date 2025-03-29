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
 * Attempts to identify if the response is an error page or not useful content
 * @param {string} text - Text to check
 * @returns {boolean} - True if it appears to be an error page
 */
const isErrorPage = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  const errorIndicators = [
    'You need to enable JavaScript',
    '<!doctype html>',
    '<html',
    '<body>',
    'Error',
    '404',
    '500',
    'Not Found',
    'Internal Server Error',
    'JavaScript is required',
    'enable JavaScript',
    'User Registration'
  ];
  
  return errorIndicators.some(indicator => 
    text.toLowerCase().includes(indicator.toLowerCase())
  );
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
    
    const response = await axios.post('https://web-production-3db6c.up.railway.app/humanize_text', {
      text
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain'  // Try to request plain text
      },
      timeout: 12000 // 12 second timeout
    });
    
    console.log('External API response type:', typeof response.data);
    
    // Handle different response formats from the external API
    if (typeof response.data === 'string') {
      // API returned a string directly
      const sanitized = sanitizeHtml(response.data);
      
      // Check if it looks like an error page
      if (isErrorPage(sanitized)) {
        throw new Error('API returned an error page');
      }
      
      return sanitized;
    } else if (response.data && response.data.humanized_text) {
      // API returned an object with humanized_text property
      return sanitizeHtml(response.data.humanized_text);
    } else if (response.data && response.data.result) {
      // API returned an object with result property
      return sanitizeHtml(response.data.result);
    } else if (response.data && typeof response.data === 'object') {
      // API returned an object, but we don't know the exact structure
      // Try to find a property that might contain the humanized text
      const possibleProps = ['text', 'content', 'output', 'humanized'];
      for (const prop of possibleProps) {
        if (response.data[prop] && typeof response.data[prop] === 'string') {
          return sanitizeHtml(response.data[prop]);
        }
      }
      
      // If we can't find a likely property, throw an error
      throw new Error('Unknown response format from external API');
    } else {
      // Unexpected response format
      throw new Error('Unexpected response format from external API');
    }
  } catch (error) {
    console.error('Error in humanizeText function:', error.message);
    
    // Throw error to be handled by the route handler
    if (error.response) {
      throw new Error(`External API returned status ${error.response.status}`);
    } else if (error.request) {
      throw new Error('No response received from external API');
    }
    
    // Re-throw the error
    throw error;
  }
};

module.exports = { humanizeText };
