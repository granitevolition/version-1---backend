const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');
const { humanizeText, testHumanizeAPI } = require('../utils/humanize');
const QueueService = require('../utils/queueService');

// Fallback humanization function for emergency use
const fallbackHumanize = (text) => {
  console.log('[FALLBACK] Using emergency fallback humanization');
  
  // Basic transformations to make text more "human-like"
  return text
    .replace(/\b(AI|artificial intelligence)\b/gi, 'I')
    .replace(/\b(therefore|hence|thus)\b/gi, 'so')
    .replace(/\b(utilize|utilization)\b/gi, 'use')
    .replace(/\b(additional)\b/gi, 'more')
    .replace(/\b(demonstrate)\b/gi, 'show')
    .replace(/\b(sufficient)\b/gi, 'enough')
    .replace(/\b(possess|possesses)\b/gi, 'have')
    .replace(/\b(regarding)\b/gi, 'about')
    .replace(/\b(numerous)\b/gi, 'many')
    .replace(/\b(commence|initiate)\b/gi, 'start')
    .replace(/\b(terminate)\b/gi, 'end')
    .replace(/\b(subsequently)\b/gi, 'then')
    .replace(/\b(furthermore)\b/gi, 'also')
    // Add sentence variety
    .replace(/\. ([A-Z])/g, (match, p1) => {
      const randomValue = Math.random();
      if (randomValue < 0.1) return `, and ${p1.toLowerCase()}`;
      if (randomValue < 0.2) return `! ${p1}`;
      if (randomValue < 0.3) return `... ${p1}`;
      return match;
    });
};

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
 * EMERGENCY FALLBACK endpoint - for when nothing else works
 */
router.post('/emergency', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    // Count words in the content
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    // Use the emergency fallback humanization
    console.log(`Using emergency fallback for ${wordCount} words`);
    const humanizedContent = fallbackHumanize(content);
    
    // Return in the format the frontend expects
    return res.status(200).json({
      success: true,
      originalContent: content,
      humanizedContent: humanizedContent,
      wordCount,
      wordLimit: 500,
      note: "Using emergency fallback mode - external API unreachable"
    });
    
  } catch (error) {
    console.error('Error in emergency endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Shortcut endpoint for immediate processing - bypasses the queue
 * This provides backward compatibility with the frontend
 */
router.post('/direct', authenticateToken, async (req, res) => {
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
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    if (wordCount > wordLimit) {
      return res.status(403).json({ 
        error: 'Word limit exceeded', 
        wordCount,
        wordLimit,
        subscriptionStatus: userProfile.status,
        planType: userProfile.plan_type || 'free'
      });
    }
    
    // Process text directly - no queue
    console.log(`Direct processing ${wordCount} words for user ${req.user.id}`);
    
    let humanizedContent;
    try {
      // Try to use the regular humanization function
      humanizedContent = await humanizeText(content);
      
      // Check if we got HTML or an error
      if (typeof humanizedContent === 'string' && (
        humanizedContent.includes('<html') || 
        humanizedContent.includes('<!DOCTYPE') || 
        humanizedContent.includes('User Registration')
      )) {
        // If we got HTML, use the fallback
        console.log('Got HTML response, using fallback');
        humanizedContent = fallbackHumanize(content);
      }
    } catch (apiError) {
      // If humanizeText fails, use the fallback
      console.error('Error calling humanizeText, using fallback:', apiError.message);
      humanizedContent = fallbackHumanize(content);
    }
    
    // Log usage
    await db.query(
      'INSERT INTO humanize_usage (user_id, word_count, timestamp) VALUES ($1, $2, NOW())',
      [req.user.id, wordCount]
    );
    
    // Return in the format the frontend expects
    return res.status(200).json({
      success: true,
      originalContent: content,
      humanizedContent,
      wordCount,
      wordLimit
    });
    
  } catch (error) {
    console.error('Error in direct endpoint:', error);
    
    // Even if something goes wrong, try to return a humanized result using fallback
    try {
      const content = req.body.content || '';
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const humanizedContent = fallbackHumanize(content);
      
      return res.status(200).json({
        success: true,
        originalContent: content,
        humanizedContent,
        wordCount,
        wordLimit: 500,
        note: "Using emergency fallback mode due to an error"
      });
    } catch (fallbackError) {
      return res.status(500).json({ 
        error: 'The humanization service encountered an error. Please try again later.',
        details: error.message
      });
    }
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
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
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
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    if (wordCount > wordLimit) {
      return res.status(403).json({ 
        error: 'Word limit exceeded', 
        wordCount,
        wordLimit,
        subscriptionStatus: userProfile.status,
        planType: userProfile.plan_type || 'free'
      });
    }
    
    // Process directly (no queue) for backward compatibility
    try {
      // Call the humanize API using our utility
      console.log(`Legacy endpoint: Direct processing ${wordCount} words for user ${req.user.id}`);
      
      let humanizedContent;
      try {
        // Try to use the regular humanization function
        humanizedContent = await humanizeText(content);
        
        // Check if we got HTML or an error
        if (typeof humanizedContent === 'string' && (
          humanizedContent.includes('<html') || 
          humanizedContent.includes('<!DOCTYPE') || 
          humanizedContent.includes('User Registration')
        )) {
          // If we got HTML, use the fallback
          console.log('Got HTML response, using fallback');
          humanizedContent = fallbackHumanize(content);
        }
      } catch (apiError) {
        // If humanizeText fails, use the fallback
        console.error('Error calling humanizeText, using fallback:', apiError.message);
        humanizedContent = fallbackHumanize(content);
      }
      
      // Log usage for analytics and billing
      await db.query(
        'INSERT INTO humanize_usage (user_id, word_count, timestamp) VALUES ($1, $2, NOW())',
        [req.user.id, wordCount]
      );
      
      // Return in the expected format for backward compatibility
      return res.status(200).json({
        success: true,
        originalContent: content,
        humanizedContent: humanizedContent,
        wordCount,
        wordLimit
      });
    } catch (apiError) {
      console.error('Error calling humanize API:', apiError.message);
      
      // Try fallback humanization as a last resort
      try {
        const humanizedContent = fallbackHumanize(content);
        
        // Log usage for analytics and billing
        await db.query(
          'INSERT INTO humanize_usage (user_id, word_count, timestamp) VALUES ($1, $2, NOW())',
          [req.user.id, wordCount]
        );
        
        return res.status(200).json({
          success: true,
          originalContent: content,
          humanizedContent: humanizedContent,
          wordCount,
          wordLimit,
          note: "Using emergency fallback mode - external API unreachable"
        });
      } catch (fallbackError) {
        return res.status(503).json({ 
          error: 'The humanization service is currently unavailable. Please try again later.',
          details: apiError.message
        });
      }
    }
    
  } catch (error) {
    console.error('Error in humanize endpoint:', error);
    
    // Try emergency fallback as absolute last resort
    try {
      const content = req.body.content || '';
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const humanizedContent = fallbackHumanize(content);
      
      return res.status(200).json({
        success: true,
        originalContent: content,
        humanizedContent,
        wordCount,
        wordLimit: 500,
        note: "Using emergency fallback mode due to an error"
      });
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;
