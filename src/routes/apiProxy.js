const express = require('express');
const router = express.Router();
const apiProxyController = require('../controllers/apiProxyController');

// Health check endpoint
router.get('/health', apiProxyController.healthCheck);

// Session reset endpoint
router.post('/reset-sessions', apiProxyController.resetSessions);

// Form submission handler
router.post('/form/:path(*)', apiProxyController.handleFormSubmission);

// Generic API route handler that captures all paths and methods
router.all('/:path(*)', apiProxyController.handleApiRequest);

module.exports = router;