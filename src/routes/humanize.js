const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');
const { humanizeText, testHumanizeAPI } = require('../utils/humanize');
const QueueService = require('../utils/queueService');

/**
 * Test endpoint for checking API connectivity
 * Only accessible to authenticated users
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { text = 'This is a test of the humanization API.' } = req.body;
    
    // Call the test function
    const result = await testHumanizeAPI(text);
    
    return res.status(200).json({
      success: true,
      message: 'API test completed',
      result
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return res.status(500).json({ 
      error: 'Test failed',
      message: error.message
    });
  }
});

/**
 * Direct test endpoint - use with caution
 * This is mainly for diagnostic purposes
 */
router.post('/direct-test', async (req, res) => {
  try {
    const { text = 'Once upon a time, a curious child discovered a magical library.' } = req.body;
    
    console.log('Running direct test with text:', text);
    const result = await humanizeText(text);
    
    return res.status(200).json({
      success: true,
      original: text,
      humanized: result
    });
  } catch (error) {
    console.error('Direct test failed:', error);
    return res.status(500).json({
      error: 'Direct test failed',
      message: error.message
    });
  }
});

/**
 * Queue a humanization request
 * This endpoint adds the request to the queue instead of processing it synchronously
 */
router.post('/queue', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    // Get user profile from the database
    const user = await db.query(
      'SELECT users.id, users.email, subscriptions.plan_type, subscriptions.status FROM users LEFT JOIN subscriptions ON users.id = subscriptions.user_id WHERE users.id = $1',
      [req.user.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userProfile = user.rows[0];
    
    // Determine word limit based on subscription
    let wordLimit = 500; // Default for free users
    
    if (userProfile.status === 'active') {
      switch (userProfile.plan_type) {
        case 'premium':
          wordLimit = 2000;
          break;
        case 'business':
          wordLimit = 5000;
          break;
        case 'enterprise':
          wordLimit = 10000;
          break;
        default:
          wordLimit = 500;
      }
    }
    
    // Count words in the content
    const wordCount = content.split(/\\s+/).filter(word => word.length > 0).length;
    
    if (wordCount > wordLimit) {
      return res.status(403).json({ 
        error: 'Word limit exceeded', 
        wordCount,
        wordLimit,
        subscriptionStatus: userProfile.status,
        planType: userProfile.plan_type || 'free'
      });
    }
    
    // Add the request to the queue
    const queuedRequest = await QueueService.addToQueue(req.user.id, content, wordCount);
    
    return res.status(202).json({
      success: true,
      message: 'Humanization request queued',
      requestId: queuedRequest.id,
      status: queuedRequest.status,
      queuedAt: queuedRequest.created_at,
      wordCount,
      wordLimit
    });
  } catch (error) {
    console.error('Error queueing humanization request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get the status of a queued humanization request
 */
router.get('/status/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }
    
    // Get the status of the request
    const request = await QueueService.getStatus(requestId, req.user.id);
    
    return res.status(200).json({
      success: true,
      requestId: request.id,
      status: request.status,
      originalText: request.original_text,
      humanizedText: request.humanized_text,
      wordCount: request.word_count,
      queuedAt: request.created_at,
      updatedAt: request.updated_at,
      completedAt: request.completed_at,
      errorMessage: request.error_message,
      attempts: request.attempts
    });
  } catch (error) {
    console.error('Error getting request status:', error);
    
    if (error.message === 'Request not found or not authorized') {
      return res.status(404).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all humanization requests for the authenticated user
 */
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    // Get all requests for the user
    const requests = await QueueService.getUserRequests(
      req.user.id, 
      parseInt(limit, 10), 
      parseInt(offset, 10)
    );
    
    return res.status(200).json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error getting user requests:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Retry a failed humanization request
 */
router.post('/retry/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }
    
    // Retry the request
    const request = await QueueService.retryRequest(requestId, req.user.id);
    
    return res.status(200).json({
      success: true,
      message: 'Request queued for retry',
      requestId: request.id,
      status: request.status,
      updatedAt: request.updated_at
    });
  } catch (error) {
    console.error('Error retrying request:', error);
    
    if (error.message === 'Request not found or not authorized') {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.startsWith('Cannot retry request with status:')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get queue statistics - admin only
 */
router.get('/queue-stats', authenticateToken, async (req, res) => {
  try {
    // In a real application, you'd check if the user is an admin
    // For now, just return the stats to any authenticated user
    
    const stats = await QueueService.getStats();
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Legacy humanize endpoint - synchronous API calls
 * Kept for backward compatibility
 */
router.post('/humanize', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    // Get user profile from the database
    const user = await db.query(
      'SELECT users.id, users.email, subscriptions.plan_type, subscriptions.status FROM users LEFT JOIN subscriptions ON users.id = subscriptions.user_id WHERE users.id = $1',
      [req.user.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userProfile = user.rows[0];
    
    // Determine word limit based on subscription
    let wordLimit = 500; // Default for free users
    
    if (userProfile.status === 'active') {
      switch (userProfile.plan_type) {
        case 'premium':
          wordLimit = 2000;
          break;
        case 'business':
          wordLimit = 5000;
          break;
        case 'enterprise':
          wordLimit = 10000;
          break;
        default:
          wordLimit = 500;
      }
    }
    
    // Count words in the content
    const wordCount = content.split(/\\s+/).filter(word => word.length > 0).length;
    
    if (wordCount > wordLimit) {
      return res.status(403).json({ 
        error: 'Word limit exceeded', 
        wordCount,
        wordLimit,
        subscriptionStatus: userProfile.status,
        planType: userProfile.plan_type || 'free'
      });
    }
    
    try {
      // Add to queue and redirect to queue endpoint
      const queuedRequest = await QueueService.addToQueue(req.user.id, content, wordCount);
      
      return res.status(202).json({
        success: true,
        message: 'Humanization request queued',
        requestId: queuedRequest.id,
        status: queuedRequest.status,
        queuedAt: queuedRequest.created_at,
        originalContent: content,
        wordCount,
        wordLimit,
        note: 'Using async queue. Please use /humanize/status/:requestId to check status.'
      });
    } catch (apiError) {
      console.error('Error calling external humanize API:', apiError.message);
      return res.status(503).json({ 
        error: 'The external humanization service is currently unavailable. This is likely a temporary issue with the service. Please try again later or contact support if the problem persists.',
        details: apiError.message
      });
    }
    
  } catch (error) {
    console.error('Error in humanize endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
