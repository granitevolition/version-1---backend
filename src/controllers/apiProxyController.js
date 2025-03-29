const ApiClient = require('../services/apiClient');
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
    new transports.File({ filename: 'api-controller.log' })
  ]
});

// Create API client instance
const apiClient = new ApiClient(process.env.API_BASE_URL);

// Helper function to handle errors
const handleError = (error, req, res) => {
  const errorId = Date.now();
  logger.error(`[${errorId}] Error in ${req.method} ${req.originalUrl}: ${error.message}`);
  logger.error(`[${errorId}] Stack trace: ${error.stack}`);
  
  return res.status(500).json({
    status: 'error',
    message: 'An error occurred while processing your request',
    errorId,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

/**
 * Generic API request handler
 */
exports.handleApiRequest = async (req, res) => {
  try {
    const { path } = req.params;
    const endpoint = `/${path}`;
    
    logger.info(`Handling ${req.method} request to ${endpoint}`);
    
    let response;
    
    switch (req.method) {
      case 'GET':
        response = await apiClient.get(endpoint, req.query);
        break;
      case 'POST':
        response = await apiClient.post(endpoint, req.body);
        break;
      case 'PUT':
        response = await apiClient.put(endpoint, req.body);
        break;
      case 'DELETE':
        response = await apiClient.delete(endpoint);
        break;
      case 'PATCH':
        response = await apiClient.patch(endpoint, req.body);
        break;
      default:
        return res.status(405).json({
          status: 'error',
          message: `Method ${req.method} not allowed`
        });
    }
    
    // Set any cookies from the API response
    if (response.cookies) {
      response.cookies.forEach(cookie => {
        res.cookie(cookie.name, cookie.value, {
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: 'lax',
          path: cookie.path || '/',
          expires: cookie.expires ? new Date(cookie.expires * 1000) : undefined
        });
      });
    }
    
    // Set response headers
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        // Skip certain headers that shouldn't be forwarded
        const headersToSkip = [
          'content-length',
          'connection',
          'keep-alive',
          'transfer-encoding',
          'host'
        ];
        
        if (!headersToSkip.includes(key.toLowerCase())) {
          res.set(key, value);
        }
      });
    }
    
    // Send the response
    return res.status(response.status || 200).send(response.data);
  } catch (error) {
    return handleError(error, req, res);
  }
};

/**
 * Form submission handler
 */
exports.handleFormSubmission = async (req, res) => {
  try {
    const { path } = req.params;
    const endpoint = `/${path}`;
    
    logger.info(`Handling form submission to ${endpoint}`);
    
    const response = await apiClient.submitForm(endpoint, req.body, {
      waitForSelector: req.query.waitFor || 'body'
    });
    
    return res.status(response.status || 200).send(response.data);
  } catch (error) {
    return handleError(error, req, res);
  }
};

/**
 * Health check endpoint
 */
exports.healthCheck = async (req, res) => {
  try {
    // Perform a simple GET request to verify API connectivity
    const testEndpoint = '/';
    await apiClient.get(testEndpoint);
    
    return res.status(200).json({
      status: 'healthy',
      message: 'API communication is working correctly',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    
    return res.status(503).json({
      status: 'unhealthy',
      message: 'API communication is not working correctly',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Reset API client sessions
 */
exports.resetSessions = (req, res) => {
  try {
    apiClient.clearSessions();
    
    return res.status(200).json({
      status: 'success',
      message: 'All API client sessions have been reset',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(error, req, res);
  }
};