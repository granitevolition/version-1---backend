const puppeteerService = require('./puppeteerService');
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
    new transports.File({ filename: 'api-client.log' })
  ]
});

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || process.env.API_BASE_URL;
    this.sessions = {}; // Store session state for different endpoints
    this.requestCount = 0;
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000, // 1 second
      maxDelay: 30000 // 30 seconds
    };
  }

  /**
   * Make an API request using Puppeteer
   * 
   * @param {Object} options - Request options
   * @param {string} options.endpoint - API endpoint path
   * @param {string} options.method - HTTP method
   * @param {Object} options.headers - HTTP headers
   * @param {Object|string} options.body - Request body
   * @param {Object} options.queryParams - URL query parameters
   * @param {boolean} options.reuseSession - Whether to reuse an existing session
   * @param {Object} options.formData - Form data for POST requests
   * @param {string} options.waitForSelector - Selector to wait for after navigation
   * @returns {Promise<Object>} Response object
   */
  async request(options = {}) {
    const {
      endpoint = '',
      method = 'GET',
      headers = {},
      body = null,
      queryParams = {},
      reuseSession = true,
      formData = null,
      waitForSelector = null
    } = options;
    
    // Build URL with query parameters
    let url = `${this.baseUrl}${endpoint}`;
    if (Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, value);
      }
      url += `?${params.toString()}`;
    }
    
    // Track requests for logging and debugging
    const requestId = ++this.requestCount;
    logger.info(`[${requestId}] ${method} request to ${url}`);
    
    // Determine if we should reuse an existing session
    let sessionId = null;
    if (reuseSession && this.sessions[endpoint]) {
      sessionId = this.sessions[endpoint];
      logger.info(`[${requestId}] Reusing session ${sessionId} for ${endpoint}`);
    }
    
    // Add common headers
    const requestHeaders = {
      'Accept': 'application/json, text/html, application/xhtml+xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      ...headers
    };
    
    // Execute request with retry logic
    let attempt = 0;
    let lastError = null;
    
    while (attempt < this.retryConfig.maxRetries) {
      try {
        // If we've had previous failures, add exponential backoff
        if (attempt > 0) {
          const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );
          logger.info(`[${requestId}] Retry ${attempt}/${this.retryConfig.maxRetries} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Perform the request
        const response = await puppeteerService.performRequest({
          url,
          method,
          headers: requestHeaders,
          body,
          formData,
          waitForSelector,
          sessionId
        });
        
        // Store the session for future requests if this was successful
        if (reuseSession && response.sessionId) {
          this.sessions[endpoint] = response.sessionId;
        }
        
        // Check status code
        if (response.status >= 400) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        
        logger.info(`[${requestId}] Request successful: Status ${response.status}`);
        return {
          status: response.status,
          headers: response.headers,
          cookies: response.cookies,
          data: response.json || response.content,
          sessionId: response.sessionId
        };
      } catch (error) {
        attempt++;
        lastError = error;
        logger.error(`[${requestId}] Request attempt ${attempt} failed: ${error.message}`);
        
        // If we're at max retries, we'll throw the error after exiting the loop
        if (attempt < this.retryConfig.maxRetries) {
          // Invalidate session on error to force a new browser session on retry
          delete this.sessions[endpoint];
          sessionId = null;
        }
      }
    }
    
    // If we got here, all retry attempts failed
    logger.error(`[${requestId}] All retry attempts failed for ${url}`);
    throw lastError || new Error(`Request to ${url} failed after ${this.retryConfig.maxRetries} attempts`);
  }
  
  /**
   * Make a GET request
   */
  async get(endpoint, queryParams = {}, options = {}) {
    return this.request({
      endpoint,
      method: 'GET',
      queryParams,
      ...options
    });
  }
  
  /**
   * Make a POST request
   */
  async post(endpoint, body = {}, options = {}) {
    return this.request({
      endpoint,
      method: 'POST',
      body,
      ...options
    });
  }
  
  /**
   * Make a PUT request
   */
  async put(endpoint, body = {}, options = {}) {
    return this.request({
      endpoint,
      method: 'PUT',
      body,
      ...options
    });
  }
  
  /**
   * Make a DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request({
      endpoint,
      method: 'DELETE',
      ...options
    });
  }
  
  /**
   * Make a PATCH request
   */
  async patch(endpoint, body = {}, options = {}) {
    return this.request({
      endpoint,
      method: 'PATCH',
      body,
      ...options
    });
  }
  
  /**
   * Submit a form
   */
  async submitForm(endpoint, formData = {}, options = {}) {
    return this.request({
      endpoint,
      method: 'POST',
      formData,
      ...options
    });
  }
  
  /**
   * Clear all stored sessions
   */
  clearSessions() {
    this.sessions = {};
    logger.info('All API client sessions cleared');
  }
}

module.exports = ApiClient;