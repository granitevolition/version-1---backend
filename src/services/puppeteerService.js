const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

// Configure Winston logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'puppeteer.log' })
  ]
});

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Ensure debug directory exists
const debugDir = path.join(__dirname, '../../debug');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

// Configure browser launch options for Railway compatibility
const launchOptions = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ],
  defaultViewport: { width: 1280, height: 720 },
  // Reduced memory usage for Railway deployment
  headless: true
};

class PuppeteerService {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
    this.initializationRetries = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.activeSessions = {};
    this.sessionIdCounter = 0;
  }

  async initialize() {
    if (this.browser) return;
    if (this.isInitializing) {
      // Wait for initialization to complete
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isInitializing) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });
      return;
    }

    try {
      this.isInitializing = true;
      logger.info('Initializing Puppeteer browser');
      this.browser = await puppeteer.launch(launchOptions);
      
      this.browser.on('disconnected', async () => {
        logger.warn('Browser disconnected, will reinitialize');
        this.browser = null;
        this.isInitializing = false;
        await this.initialize();
      });
      
      logger.info('Puppeteer browser initialized successfully');
      this.isInitializing = false;
      this.initializationRetries = 0;
    } catch (error) {
      this.isInitializing = false;
      logger.error(`Browser initialization error: ${error.message}`);
      
      if (this.initializationRetries < this.maxRetries) {
        this.initializationRetries++;
        logger.info(`Retrying initialization (${this.initializationRetries}/${this.maxRetries})`);
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, this.initializationRetries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.initialize();
      } else {
        logger.error('Max initialization retries reached');
        throw new Error('Failed to initialize browser after multiple attempts');
      }
    }
  }

  async getPage() {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      
      // Configure page settings
      await page.setJavaScriptEnabled(true);
      await page.setDefaultNavigationTimeout(60000);
      await page.setRequestInterception(true);
      
      // Handle request interception for improved performance
      page.on('request', request => {
        const resourceType = request.resourceType();
        // Block unnecessary resources
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Session management
      const sessionId = this.sessionIdCounter++;
      this.activeSessions[sessionId] = { page, lastActive: Date.now() };
      
      return { page, sessionId };
    } catch (error) {
      logger.error(`Error creating page: ${error.message}`);
      // If we can't create a page, there might be issues with the browser
      this.browser = null;
      throw error;
    }
  }

  async performRequest({ url, method = 'GET', headers = {}, body = null, cookies = [], formData = null, waitForSelector = null, sessionId = null }) {
    let page;
    let currentSessionId = sessionId;
    let needToReleasePage = false;
    
    try {
      // Use existing session or create a new one
      if (sessionId !== null && this.activeSessions[sessionId]) {
        page = this.activeSessions[sessionId].page;
        this.activeSessions[sessionId].lastActive = Date.now();
      } else {
        const session = await this.getPage();
        page = session.page;
        currentSessionId = session.sessionId;
        needToReleasePage = true;
      }
      
      // Set cookies if provided
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
      }
      
      // Set extra headers
      await page.setExtraHTTPHeaders(headers);
      
      // Navigate to the URL
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        method,
        ...(body && { postData: typeof body === 'string' ? body : JSON.stringify(body) })
      });
      
      // Handle form submission if formData is provided
      if (formData && method.toUpperCase() === 'POST') {
        for (const [key, value] of Object.entries(formData)) {
          await page.type(`input[name="${key}"]`, value);
        }
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click('input[type="submit"]')
        ]);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 30000 });
      }
      
      // Get page content
      const content = await page.content();
      
      // Get cookies
      const currentCookies = await page.cookies();
      
      // Take screenshot for debugging if needed
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(debugDir, `${timestamp}-screenshot.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Get response data
      const status = response.status();
      const responseHeaders = response.headers();
      
      // Attempt to extract JSON if the content looks like JSON
      let jsonData = null;
      try {
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          jsonData = JSON.parse(content);
        } else {
          // Check if there's JSON embedded in a script tag
          jsonData = await page.evaluate(() => {
            try {
              const jsonScripts = document.querySelectorAll('script[type="application/json"]');
              if (jsonScripts.length > 0) {
                return JSON.parse(jsonScripts[0].textContent);
              }
              return null;
            } catch (e) {
              return null;
            }
          });
        }
      } catch (e) {
        // If we can't parse as JSON, that's fine, we'll return the content as-is
      }
      
      return {
        status,
        headers: responseHeaders,
        content,
        cookies: currentCookies,
        json: jsonData,
        sessionId: currentSessionId
      };
    } catch (error) {
      logger.error(`Request error for ${url}: ${error.message}`);
      
      // Take error screenshot
      if (page) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const errorScreenshotPath = path.join(debugDir, `${timestamp}-error.png`);
          await page.screenshot({ path: errorScreenshotPath, fullPage: true });
          logger.info(`Error screenshot saved to ${errorScreenshotPath}`);
        } catch (screenshotError) {
          logger.error(`Failed to take error screenshot: ${screenshotError.message}`);
        }
      }
      
      throw error;
    } finally {
      if (needToReleasePage && page) {
        try {
          await page.close();
          delete this.activeSessions[currentSessionId];
        } catch (closeError) {
          logger.error(`Error closing page: ${closeError.message}`);
        }
      }
    }
  }

  async cleanup() {
    // Cleanup inactive sessions
    const now = Date.now();
    const inactiveTimeout = 15 * 60 * 1000; // 15 minutes
    
    for (const [sessionId, session] of Object.entries(this.activeSessions)) {
      if (now - session.lastActive > inactiveTimeout) {
        try {
          await session.page.close();
          delete this.activeSessions[sessionId];
          logger.info(`Closed inactive session ${sessionId}`);
        } catch (error) {
          logger.error(`Error closing inactive session ${sessionId}: ${error.message}`);
          delete this.activeSessions[sessionId];
        }
      }
    }
  }

  async shutdown() {
    if (this.browser) {
      try {
        // Close all pages
        for (const [sessionId, session] of Object.entries(this.activeSessions)) {
          try {
            await session.page.close();
          } catch (error) {
            logger.error(`Error closing page for session ${sessionId}: ${error.message}`);
          }
        }
        
        // Clear sessions
        this.activeSessions = {};
        
        // Close browser
        await this.browser.close();
        this.browser = null;
        logger.info('Browser shutdown complete');
      } catch (error) {
        logger.error(`Error during browser shutdown: ${error.message}`);
        this.browser = null;
      }
    }
  }
}

// Create singleton instance
const puppeteerService = new PuppeteerService();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down Puppeteer service');
  await puppeteerService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down Puppeteer service');
  await puppeteerService.shutdown();
  process.exit(0);
});

// Set up session cleanup interval
setInterval(() => {
  puppeteerService.cleanup().catch(error => {
    logger.error(`Session cleanup error: ${error.message}`);
  });
}, 5 * 60 * 1000); // Run every 5 minutes

module.exports = puppeteerService;