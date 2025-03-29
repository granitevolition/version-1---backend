/**
 * Placeholder for humanize routes
 * Returns 410 Gone status to indicate endpoint is no longer available
 */

const express = require('express');
const router = express.Router();

// All routes return 410 Gone status
router.all('*', (req, res) => {
  res.status(410).json({
    status: 'error',
    message: 'This service has been deprecated and is no longer available',
    code: 'SERVICE_DEPRECATED'
  });
});

module.exports = router;
