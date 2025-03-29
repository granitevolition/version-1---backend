/**
 * Standalone diagnostic script for testing the external API
 * This is NOT exposed via routes - intended for administrator use only
 * 
 * Usage:
 * - Copy this file to a local environment
 * - Run with Node.js: node apitest.js
 * - This is for administrative diagnostic use only
 */

const axios = require('axios');

/**
 * Simple function to directly test the API connection
 * This bypasses the normal authentication flow for diagnostic purposes only
 */
async function testApiDirectly() {
  try {
    console.log('Testing direct connection to humanization API...');
    
    const testText = 'Once upon a time in a bustling city, a curious child named Leo stumbled upon a secret library filled with ancient books and magical creatures.';
    
    const response = await axios({
      method: 'post',
      url: 'https://web-production-3db6c.up.railway.app/humanize_text',
      data: { text: testText },
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Type:', typeof response.data);
    
    if (typeof response.data === 'string') {
      console.log('API Response Text:', response.data);
    } else {
      console.log('API Response Object:', JSON.stringify(response.data, null, 2));
    }
    
    return {
      success: true,
      response: response.data
    };
  } catch (error) {
    console.error('Error testing API directly:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run the test
 */
(async () => {
  console.log('Starting API diagnostic test');
  console.log('-----------------------------');
  
  const result = await testApiDirectly();
  
  console.log('-----------------------------');
  console.log('Test complete. Result:', result.success ? 'SUCCESS' : 'FAILED');
  
  if (!result.success) {
    console.error('Error details:', result.error);
    process.exit(1);
  }
  
  process.exit(0);
})();
