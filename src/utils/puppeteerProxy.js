const puppeteer = require('puppeteer');

/**
 * Uses Puppeteer to access the humanization API exactly as a browser would
 * This ensures we handle any browser-specific behaviors, cookies, JavaScript execution, etc.
 * Enhanced with Railway-specific configurations
 * 
 * @param {string} text - Text to humanize
 * @returns {Promise<string>} - Humanized text
 */
async function puppeteerHumanize(text) {
  let browser = null;
  try {
    console.log('[PUPPETEER] Starting browser instance with Railway compatibility settings');
    
    // Launch a headless browser with Railway compatibility settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
      timeout: 30000
    });
    
    // Open a new page
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // Add additional request headers for every request
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'sec-ch-ua': '"Google Chrome";v="121", "Not;A=Brand";v="8", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });
    
    // Navigate to the API endpoint
    console.log('[PUPPETEER] Navigating to API endpoint');
    try {
      await page.goto('https://web-production-3db6c.up.railway.app/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    } catch (navigationError) {
      console.error('[PUPPETEER] Navigation error:', navigationError.message);
      console.log('[PUPPETEER] Continuing anyway - page might have loaded partially');
    }
    
    // Wait a moment for any potential redirects or page loads
    await page.waitForTimeout(2000);
    
    // Log the page title to debug
    const title = await page.title();
    console.log('[PUPPETEER] Page title:', title);
    
    // Log some page details for debugging
    const url = page.url();
    console.log('[PUPPETEER] Current URL:', url);
    
    // Take screenshot for debugging (save to memory)
    const screenshot = await page.screenshot({ encoding: 'base64' });
    console.log('[PUPPETEER] Screenshot taken, size:', screenshot.length, 'bytes');
    
    // Execute the API call directly in the browser context
    console.log('[PUPPETEER] Executing API call with text length:', text.length);
    const result = await page.evaluate(async (inputText) => {
      try {
        // Log in the browser context for debugging
        console.log('Browser context: Making API request with text length', inputText.length);
        
        // Prepare form data method - try FormData approach
        const formData = new FormData();
        formData.append('text', inputText);
        
        // Make the API call within the browser context using FormData
        console.log('Browser context: Trying FormData approach');
        const response = await fetch('/humanize_text', {
          method: 'POST',
          body: formData
        });
        
        // Check response
        if (!response.ok) {
          console.log('Browser context: FormData approach failed with status', response.status);
          throw new Error(`API returned status ${response.status}`);
        }
        
        // Try to parse as JSON first
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const jsonData = await response.json();
          console.log('Browser context: Received JSON response');
          if (jsonData.humanized_text) return jsonData.humanized_text;
          if (jsonData.result) return jsonData.result;
          return JSON.stringify(jsonData);
        } else {
          // Fallback to text
          console.log('Browser context: Received text response');
          const textData = await response.text();
          return textData;
        }
      } catch (formDataError) {
        console.log('Browser context: FormData approach failed:', formDataError.message);
        
        // Try JSON approach as fallback
        try {
          console.log('Browser context: Trying JSON approach');
          const jsonResponse = await fetch('/humanize_text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: inputText })
          });
          
          if (!jsonResponse.ok) {
            console.log('Browser context: JSON approach failed with status', jsonResponse.status);
            throw new Error(`API returned status ${jsonResponse.status}`);
          }
          
          // Try to parse as JSON first
          const contentType = jsonResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const jsonData = await jsonResponse.json();
            console.log('Browser context: Received JSON response');
            if (jsonData.humanized_text) return jsonData.humanized_text;
            if (jsonData.result) return jsonData.result;
            return JSON.stringify(jsonData);
          } else {
            // Fallback to text
            console.log('Browser context: Received text response');
            const textData = await jsonResponse.text();
            return textData;
          }
        } catch (jsonError) {
          return `ERROR: Form data approach failed: ${formDataError.message}, JSON approach failed: ${jsonError.message}`;
        }
      }
    }, text);
    
    console.log('[PUPPETEER] Received result:', result.substring(0, 50) + '...');
    
    // Check if there was an error
    if (result.startsWith('ERROR:')) {
      throw new Error(result.substring(7));
    }
    
    // Check if it's HTML (should never happen with Puppeteer, but just in case)
    if (result.includes('<html') || result.includes('<!DOCTYPE') || result.includes('User Registration')) {
      throw new Error('API returned HTML page instead of humanized text');
    }
    
    return result;
  } catch (error) {
    console.error('[PUPPETEER] Error:', error);
    throw error;
  } finally {
    // Always close the browser
    if (browser) {
      console.log('[PUPPETEER] Closing browser');
      await browser.close();
    }
  }
}

module.exports = { puppeteerHumanize };
