const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');
const { humanizeText } = require('../utils/humanize');

/**
 * Humanize AI content based on user subscription level
 * 
 * Free users are limited to 500 words
 * Premium users have higher word limits (based on their subscription tier)
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
    
    try {
      // Call the humanize API using our utility
      const humanizedContent = await humanizeText(content);
      
      // Log usage for analytics and billing
      await db.query(
        'INSERT INTO humanize_usage (user_id, word_count, timestamp) VALUES ($1, $2, NOW())',
        [req.user.id, wordCount]
      );
      
      return res.status(200).json({
        success: true,
        originalContent: content,
        humanizedContent,
        wordCount,
        wordLimit
      });
    } catch (apiError) {
      console.error('Error calling external humanize API:', apiError.message);
      return res.status(503).json({ 
        error: 'Humanization service temporarily unavailable. Please try again later.',
        details: apiError.message
      });
    }
    
  } catch (error) {
    console.error('Error in humanize endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
