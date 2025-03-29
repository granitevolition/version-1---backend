const axios = require('axios');

/**
 * Sends text directly to the external humanizing API and returns the humanized content
 * This is a simplified version that directly calls the API with minimal processing
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('Calling external humanize API with text:', text.substring(0, 100) + '...');
    
    // Make direct API call to external service - keeping it simple and direct
    const response = await axios({
      method: 'post',
      url: 'https://web-production-3db6c.up.railway.app/humanize_text',
      data: { text }, // IMPORTANT: sending 'text' not 'content'
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000, // 30 second timeout
    });
    
    console.log('API response status:', response.status);
    
    // Handle different response formats
    if (typeof response.data === 'string') {
      // Most likely just the humanized text as a string
      return response.data;
    } else if (typeof response.data === 'object') {
      // If response is JSON, extract the result
      if (response.data.result) {
        return response.data.result;
      } else if (response.data.humanized_text) {
        return response.data.humanized_text;
      } else {
        // If we can't find a known field, return the stringified JSON
        return JSON.stringify(response.data);
      }
    } else {
      throw new Error('Unexpected response format from API');
    }
  } catch (error) {
    console.error('Error calling external humanize API:', error.message);
    
    // Provide detailed error for debugging
    if (error.response) {
      console.error('API response error status:', error.response.status);
      console.error('Error response data:', 
        typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) 
          : JSON.stringify(error.response.data).substring(0, 200)
      );
    }
    
    throw new Error('Failed to humanize text via external API: ' + error.message);
  }
};

/**
 * Test function to directly access the humanize API
 */
const testHumanizeAPI = async (text) => {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://web-production-3db6c.up.railway.app/humanize_text',
      data: { text },
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    return {
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      error: error.message,
      data: error.response ? error.response.data : null
    };
  }
};

// Export both functions
module.exports = { humanizeText, testHumanizeAPI };
