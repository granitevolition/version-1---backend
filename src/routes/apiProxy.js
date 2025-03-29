/**
 * Placeholder for API Proxy routes
 * Returns 410 Gone status to indicate the API proxy is no longer available
 */

const express = require('express');
const router = express.Router();
const { proxyRequest } = require('../controllers/apiProxyController');

// All routes return 410 Gone status
router.all('*', proxyRequest);

module.exports = router;
