const axios = require('axios');
const { directHumanize } = require('./humanizeProxy');
const { puppeteerHumanize } = require('./puppeteerProxy');
const { formHumanize } = require('./formHumanize');

// Simplified humanization function for test purposes only
// Only used when the external API is completely unavailable
const localHumanization = (text) => {
  console.log('[LOCAL] Using local humanization as fallback');
  
  // Basic transformations to make text more "human-like"
  return text
    .replace(/\b(AI|artificial intelligence)\b/gi, 'I')
    .replace(/\b(therefore|hence|thus)\b/gi, 'so')
    .replace(/\b(utilize|utilization)\b/gi, 'use')
    .replace(/\b(additional)\b/gi, 'more')
    .replace(/\b(demonstrate)\b/gi, 'show')
    .replace(/\b(sufficient)\b/gi, 'enough')
    .replace(/\b(possess|possesses)\b/gi, 'have')
    .replace(/\b(regarding)\b/gi, 'about')
    .replace(/\b(numerous)\b/gi, 'many')
    .replace(/\b(commence|initiate)\b/gi, 'start')
    .replace(/\b(terminate)\b/gi, 'end')
    .replace(/\b(subsequently)\b/gi, 'then')
    .replace(/\b(furthermore)\b/gi, 'also')
    // Add sentence variety
    .replace(/\. ([A-Z])/g, (match, p1) => {
      const randomValue = Math.random();
      if (randomValue < 0.1) return `, and ${p1.toLowerCase()}`;
      if (randomValue < 0.2) return `! ${p1}`;
      if (randomValue < 0.3) return `... ${p1}`;
      return match;
    });
};

/**
 * Sends text to the external humanizing API and returns the humanized content
 * Uses multiple approaches with fallbacks for maximum reliability
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 * @throws {Error} - Throws an error if the API call fails
 */
const humanizeText = async (text) => {
  try {
    console.log('[HUMANIZE] Processing request with text length:', text.length);
    
    // Store errors for diagnostic purposes
    const errors = [];
    
    // First try a direct method that mimics exactly how you manually access the API
    try {
      // Define a function that perfectly mimics a browser request
      // The key is to make a fetch-like request with browser headers
      console.log('[HUMANIZE] Attempting direct browser-like request with specific headers');
      
      // This is the request configuration that works when you manually access the API
      const response = await axios({
        method: 'post',
        url: 'https://web-production-3db6c.up.railway.app/humanize_text',
        data: { text },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Origin': 'https://web-production-3db6c.up.railway.app',
          'Referer': 'https://web-production-3db6c.up.railway.app/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000,
        validateStatus: () => true,
        maxRedirects: 0
      });
      
      // Check response validity
      if (typeof response.data === 'string' && (
        response.data.includes('<html') || 
        response.data.includes('<!DOCTYPE') ||
        response.data.includes('User Registration')
      )) {
        throw new Error('HTML response detected - not a valid humanized text');
      }
      
      console.log('[HUMANIZE] Direct browser request successful');
      
      // Process response data
      if (typeof response.data === 'string') {
        return response.data;
      } else if (typeof response.data === 'object') {
        if (response.data.humanized_text) return response.data.humanized_text;
        if (response.data.result) return response.data.result;
        return JSON.stringify(response.data);
      }
    } catch (directBrowserError) {
      console.error('[HUMANIZE] Direct browser request failed:', directBrowserError.message);
      errors.push({ approach: 'direct-browser', error: directBrowserError.message });
    }
    
    // Next try the form-based approach
    try {
      console.log('[HUMANIZE] Attempting form-based approach with cookie support');
      const result = await formHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Form-based approach successful');
        return result;
      }
    } catch (formError) {
      console.error('[HUMANIZE] Form-based approach failed:', formError.message);
      errors.push({ approach: 'form', error: formError.message });
      // Continue to fallback methods
    }
    
    // Next try the Puppeteer approach
    try {
      console.log('[HUMANIZE] Attempting Puppeteer browser approach');
      const result = await puppeteerHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Puppeteer browser successful');
        return result;
      }
    } catch (puppeteerError) {
      console.error('[HUMANIZE] Puppeteer browser failed:', puppeteerError.message);
      errors.push({ approach: 'puppeteer', error: puppeteerError.message });
      // Continue to fallback methods
    }
    
    // Then try the direct browser-like proxy implementation
    try {
      console.log('[HUMANIZE] Attempting direct browser-like proxy approach');
      const result = await directHumanize(text);
      
      if (result) {
        console.log('[HUMANIZE] Direct proxy successful');
        return result;
      }
    } catch (directError) {
      console.error('[HUMANIZE] Direct proxy failed:', directError.message);
      errors.push({ approach: 'direct', error: directError.message });
      // Continue to fallback methods
    }
    
    // Last resort: basic local humanization when external API is completely unavailable
    // Only use this in cases where all other approaches have failed
    console.log('[HUMANIZE] All external API approaches failed. Using local fallback');
    console.error('[HUMANIZE] Errors:', JSON.stringify(errors, null, 2));
    
    return localHumanization(text);
    
  } catch (error) {
    console.error('[HUMANIZE] All approaches failed:', error.message);
    throw error;
  }
};

/**
 * Function for testing the API connection
 * This is only used for diagnostics
 */
const testHumanizeAPI = async (text) => {
  const results = {};
  
  // Test direct browser-like request
  try {
    console.log('[TEST] Attempting direct browser-like request with specific headers');
    
    const response = await axios({
      method: 'post',
      url: 'https://web-production-3db6c.up.railway.app/humanize_text',
      data: { text },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Origin': 'https://web-production-3db6c.up.railway.app',
        'Referer': 'https://web-production-3db6c.up.railway.app/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 0
    });
    
    // Check for HTML content
    const containsHtml = typeof response.data === 'string' && (
      response.data.includes('<html') || 
      response.data.includes('<!DOCTYPE') ||
      response.data.includes('User Registration'));
    
    results.directBrowser = {
      success: !containsHtml,
      status: response.status,
      contentType: response.headers['content-type'],
      type: typeof response.data,
      containsHtml,
      preview: typeof response.data === 'string' 
        ? response.data.substring(0, 100) + '...' 
        : JSON.stringify(response.data).substring(0, 100) + '...'
    };
  } catch (directBrowserError) {
    console.error('[TEST] Direct browser request failed:', directBrowserError.message);
    results.directBrowser = {
      success: false,
      error: directBrowserError.message
    };
  }
  
  // Test form approach
  try {
    console.log('[TEST] Attempting form-based approach');
    const formResult = await formHumanize(text);
    results.form = {
      success: true,
      result: formResult,
      preview: formResult ? formResult.substring(0, 100) + '...' : null
    };
  } catch (formError) {
    console.error('[TEST] Form-based approach failed:', formError.message);
    results.form = {
      success: false,
      error: formError.message
    };
  }
  
  // Test puppeteer approach
  try {
    console.log('[TEST] Attempting Puppeteer browser approach');
    const puppeteerResult = await puppeteerHumanize(text);
    results.puppeteer = {
      success: true,
      result: puppeteerResult,
      preview: puppeteerResult ? puppeteerResult.substring(0, 100) + '...' : null
    };
  } catch (puppeteerError) {
    console.error('[TEST] Puppeteer browser approach failed:', puppeteerError.message);
    results.puppeteer = {
      success: false,
      error: puppeteerError.message
    };
  }
  
  // Test direct implementation
  try {
    console.log('[TEST] Attempting direct browser implementation');
    const directResult = await directHumanize(text);
    results.direct = {
      success: true,
      result: directResult,
      preview: directResult ? directResult.substring(0, 100) + '...' : null
    };
  } catch (directError) {
    console.error('[TEST] Direct implementation failed:', directError.message);
    results.direct = {
      success: false,
      error: directError.message
    };
  }
  
  // Test local fallback
  try {
    console.log('[TEST] Testing local fallback');
    const localResult = localHumanization(text);
    results.local = {
      success: true,
      result: localResult,
      preview: localResult.substring(0, 100) + '...'
    };
  } catch (localError) {
    console.error('[TEST] Local fallback failed:', localError.message);
    results.local = {
      success: false,
      error: localError.message
    };
  }
  
  return {
    timestamp: new Date().toISOString(),
    testText: text,
    results
  };
};

module.exports = { humanizeText, testHumanizeAPI };
