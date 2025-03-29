const puppeteer = require('puppeteer');

/**
 * Uses Puppeteer to access the humanization API exactly as a browser would
 * This ensures we handle any browser-specific behaviors, cookies, JavaScript execution, etc.
 * 
 * @param {string} text - Text to humanize
 * @returns {Promise<string>} - Humanized text
 */
async function puppeteerHumanize(text) {
  let browser = null;
  try {
    console.log('[PUPPETEER] Starting browser instance');
    
    // Launch a headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    // Open a new page
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // Navigate to the API endpoint
    console.log('[PUPPETEER] Navigating to API endpoint');
    await page.goto('https://web-production-3db6c.up.railway.app/');
    
    // Wait a moment for any potential redirects or page loads
    await page.waitForTimeout(2000);
    
    // Execute the API call directly in the browser context
    console.log('[PUPPETEER] Executing API call with text length:', text.length);
    const result = await page.evaluate(async (inputText) => {
      try {
        // Make the API call within the browser context
        const response = await fetch('/humanize_text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: inputText })
        });
        
        // Parse the response
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        // Try to parse as JSON first
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const jsonData = await response.json();
          if (jsonData.humanized_text) return jsonData.humanized_text;
          if (jsonData.result) return jsonData.result;
          return JSON.stringify(jsonData);
        } else {
          // Fallback to text
          const textData = await response.text();
          return textData;
        }
      } catch (error) {
        return `ERROR: ${error.message}`;
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
