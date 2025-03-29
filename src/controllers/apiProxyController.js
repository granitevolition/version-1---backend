/**
 * Placeholder for API Proxy Controller
 * Returns 410 Gone status to indicate the API proxy is no longer available
 */

// Placeholder controller functions that return 410 Gone status
const proxyRequest = (req, res) => {
  res.status(410).json({
    status: 'error',
    message: 'API proxy service has been deprecated and is no longer available',
    code: 'PROXY_DEPRECATED'
  });
};

module.exports = {
  proxyRequest
};
