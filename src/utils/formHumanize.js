const axios = require('axios');
const FormData = require('form-data');

/**
 * Humanizes text using form data approach with custom headers
 * Some APIs require form data instead of JSON
 * 
 * @param {string} text - Text to humanize
 * @returns {Promise<string>} - Humanized text
 */
async function formHumanize(text) {
  try {
    console.log('[FORM HUMANIZE] Starting form data request process');
    
    // Create a FormData object
    const formData = new FormData();
    formData.append('text', text);
    
    // Get the form data headers
    const formHeaders = formData.getHeaders();
    
    // Combine with browser-like headers
    const headers = {
      ...formHeaders,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/plain,application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://web-production-3db6c.up.railway.app',
      'Referer': 'https://web-production-3db6c.up.railway.app/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      'sec-ch-ua': '"Google Chrome";v="121", "Not;A=Brand";v="8", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    };
    
    console.log('[FORM HUMANIZE] Form data created and headers prepared');
    
    // First, try to get the main page to gather cookies
    const mainPageResponse = await axios.get('https://web-production-3db6c.up.railway.app/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      maxRedirects: 5
    });
    
    console.log('[FORM HUMANIZE] Main page status:', mainPageResponse.status);
    
    // Extract cookies if any
    if (mainPageResponse.headers['set-cookie']) {
      headers.Cookie = mainPageResponse.headers['set-cookie'].join('; ');
      console.log('[FORM HUMANIZE] Cookies extracted from main page');
    }
    
    // Make the POST request to the humanize_text endpoint
    console.log('[FORM HUMANIZE] Making POST request to API with form data');
    const response = await axios.post(
      'https://web-production-3db6c.up.railway.app/humanize_text',
      formData,
      {
        headers,
        timeout: 30000,
        maxRedirects: 5
      }
    );
    
    console.log('[FORM HUMANIZE] Response status:', response.status);
    console.log('[FORM HUMANIZE] Response content type:', response.headers['content-type']);
    
    // Check for HTML content
    const responseData = response.data;
    if (typeof responseData === 'string' && (
      responseData.includes('<html') || 
      responseData.includes('<!DOCTYPE') || 
      responseData.includes('User Registration')
    )) {
      console.error('[FORM HUMANIZE] API returned HTML instead of humanized text');
      throw new Error('API returned HTML page instead of humanized text');
    }
    
    // Handle different response formats
    if (typeof responseData === 'string') {
      return responseData;
    } else if (typeof responseData === 'object') {
      if (responseData.humanized_text) return responseData.humanized_text;
      if (responseData.result) return responseData.result;
      if (responseData.text) return responseData.text;
      if (responseData.output) return responseData.output;
      
      return JSON.stringify(responseData);
    }
    
    throw new Error('Unexpected response format from form humanization');
  } catch (error) {
    console.error('[FORM HUMANIZE] Error:', error.message);
    if (error.response) {
      console.error('[FORM HUMANIZE] Response status:', error.response.status);
      console.error('[FORM HUMANIZE] Response headers:', JSON.stringify(error.response.headers));
      console.error('[FORM HUMANIZE] Response data:', typeof error.response.data === 'string' 
        ? error.response.data.substring(0, 200) 
        : JSON.stringify(error.response.data).substring(0, 200));
    }
    throw error;
  }
}

module.exports = { formHumanize };
