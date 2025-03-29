const axios = require('axios');

/**
 * Sends text to the external humanizing API and returns the humanized content
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 */
const humanizeText = async (text) => {
  try {
    console.log('Calling external humanize API with text:', text.substring(0, 100) + '...');
    
    const response = await axios.post('https://web-production-3db6c.up.railway.app/humanize_text', {
      text
    });
    
    console.log('External API response:', response.data);
    
    // Handle different response formats from the external API
    if (typeof response.data === 'string') {
      // API returned a string directly
      return response.data;
    } else if (response.data && response.data.humanized_text) {
      // API returned an object with humanized_text property
      return response.data.humanized_text;
    } else if (response.data && response.data.result) {
      // API returned an object with result property
      return response.data.result;
    } else if (response.data && typeof response.data === 'object') {
      // API returned an object, but we don't know the exact structure
      // Try to find a property that might contain the humanized text
      const possibleProps = ['text', 'content', 'output', 'humanized'];
      for (const prop of possibleProps) {
        if (response.data[prop] && typeof response.data[prop] === 'string') {
          return response.data[prop];
        }
      }
      
      // If we can't find a likely property, just stringify the whole object
      return JSON.stringify(response.data);
    } else {
      // Fallback for unexpected response formats
      return `[Humanized] ${text}`;
    }
  } catch (error) {
    console.error('Error calling humanize API:', error.message);
    if (error.response) {
      console.error('API response error data:', error.response.data);
      console.error('API response status:', error.response.status);
    }
    throw new Error(`Failed to humanize text: ${error.message}`);
  }
};

module.exports = { humanizeText };
