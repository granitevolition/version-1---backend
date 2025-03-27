const express = require('express');
const router = express.Router();

// Simple test endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'API is reachable',
    timestamp: new Date().toISOString()
  });
});

// Echo endpoint - returns whatever was sent
router.post('/echo', (req, res) => {
  console.log('Echo endpoint called with body:', req.body);
  res.status(200).json({
    message: 'Echo response',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
