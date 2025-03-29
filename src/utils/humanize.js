const axios = require('axios');

const humanizeText = async (text) => {
  try {
    const response = await axios.post('https://web-production-3db6c.up.railway.app/humanize_text', {
      text
    });
    
    // Return the humanized text (assuming API returns text directly)
    return response.data;
  } catch (error) {
    console.error('Error calling humanize API:', error);
    throw new Error('Failed to humanize text');
  }
};

module.exports = { humanizeText };
