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
    console.log('Calling external humanize API with text:', text.substring(0, 100) + '...');
    
    // API endpoint
    const apiEndpoint = 'https://web-production-3db6c.up.railway.app/humanize_text';
    
    // Make a direct axios post request with detailed logging
    console.log(`Sending request to ${apiEndpoint}`);
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text }, // IMPORTANT: The external API expects "text" not "content"
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('External API response status:', response.status);
    
    // If the response is a string, it's likely the humanized text
    if (typeof response.data === 'string') {
      return response.data;
    }
    
    // If the response is a JSON object, extract the result from known fields
    if (typeof response.data === 'object') {
      if (response.data.result) {
        return response.data.result;
      } else if (response.data.humanized_text) {
        return response.data.humanized_text;
      } else {
        // If we can't identify the format, stringify the response
        console.warn('Unknown response format:', JSON.stringify(response.data).substring(0, 200));
        return JSON.stringify(response.data);
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
    
    throw new Error('Failed to humanize text: ' + (error.message || 'Unknown error'));
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
    
    const response = await axios({
      method: 'post',
      url: apiEndpoint,
      data: { text }, // IMPORTANT: The external API expects "text" not "content"
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 10000
    });
    
    return {
      status: response.status,
      type: typeof response.data,
      preview: typeof response.data === 'string' 
        ? response.data.substring(0, 300) 
        : JSON.stringify(response.data).substring(0, 300)
    };
  } catch (error) {
    console.error('Test API error:', error.message);
    return {
      error: error.message
    };
  }
};

module.exports = { humanizeText, testHumanizeAPI };
