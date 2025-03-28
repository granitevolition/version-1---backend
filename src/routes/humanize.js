const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../utils/authMiddleware');
const fetch = require('node-fetch');

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
    
    // Call the actual AI humanizing service
    // This would be your integration with an LLM or custom service
    const humanizedContent = await humanizeContent(content);
    
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
    
  } catch (error) {
    console.error('Error humanizing content:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * The actual implementation of content humanizing
 * This would typically call an external AI API like OpenAI, Anthropic, etc.
 */
async function humanizeContent(content) {
  try {
    // This is a placeholder - you would replace this with your actual humanizing service
    // Example integration with OpenAI:
    
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert writer who makes AI-generated content sound more natural and human-written. Keep the same information but improve the style, tone, and flow.'
          },
          {
            role: 'user',
            content: `Please humanize the following content: ${content}`
          }
        ],
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
    */
    
    // For now, we'll just return a modified version of the input
    // Replace this with your actual humanizing logic or API call
    return `[Humanized] ${content}`;
  } catch (error) {
    console.error('Error in humanization service:', error);
    throw new Error('Failed to humanize content');
  }
}

module.exports = router;
