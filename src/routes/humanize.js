const express = require('express');
const axios = require('axios');
const db = require('../db');
const { getSessionUser } = require('../utils/auth');
const { createHumanizeTables } = require('../db/migrations/humanize_tables');

const router = express.Router();

// Real humanizer API endpoint - use environment variable or default to our specific endpoint
const HUMANIZER_API_URL = process.env.HUMANIZER_API_URL || 'https://andikar-backend-code-production.up.railway.app';
const HUMANIZE_TEXT_ENDPOINT = '/humanize_text'; // The specific endpoint path

// Initialize the humanize tables
async function initializeTables() {
  try {
    await createHumanizeTables();
    console.log('Humanize tables initialized');
  } catch (error) {
    console.error('Error initializing humanize tables:', error);
  }
}

// Initialize tables when the module is loaded
initializeTables();

/**
 * Humanize text endpoint
 * This acts as a proxy to the real humanizer API while tracking usage in our database
 */
router.post('/humanize-text', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text, aiScore } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please provide text to humanize'
      });
    }

    console.log(`Humanizing text (${text.length} chars). Calling API at: ${HUMANIZER_API_URL}${HUMANIZE_TEXT_ENDPOINT}`);
    
    // Get user if authenticated
    let userId = null;
    try {
      const user = await getSessionUser(req);
      if (user) {
        userId = user.id;
      }
    } catch (authError) {
      console.log('User not authenticated, continuing as guest:', authError.message);
    }
    
    // Check if user has reached their daily limit
    if (userId) {
      try {
        // Get usage statistics for this user
        const userStatsQuery = await db.query(
          'SELECT us.*, ul.daily_limit, ul.max_text_length FROM humanize_usage_statistics us ' +
          'JOIN users u ON us.user_id = u.id ' +
          'LEFT JOIN humanize_usage_limits ul ON ul.tier_name = COALESCE(u.tier, \'free\') ' +
          'WHERE us.user_id = $1',
          [userId]
        );
        
        let userStats = null;
        if (userStatsQuery.rows.length > 0) {
          userStats = userStatsQuery.rows[0];
        } else {
          // Get user's tier limits
          const tierLimitsQuery = await db.query(
            'SELECT * FROM humanize_usage_limits WHERE tier_name = $1',
            ['free'] // Default to free tier
          );
          
          if (tierLimitsQuery.rows.length > 0) {
            // Create new usage record for user
            const newUserStatsQuery = await db.query(
              'INSERT INTO humanize_usage_statistics (user_id, total_uses, total_characters) ' +
              'VALUES ($1, 0, 0) RETURNING *',
              [userId]
            );
            
            userStats = {
              ...newUserStatsQuery.rows[0],
              ...tierLimitsQuery.rows[0]
            };
          }
        }
        
        if (userStats) {
          // Check text length limit
          if (text.length > userStats.max_text_length) {
            return res.status(400).json({
              error: 'Text too long',
              message: `Your plan allows a maximum of ${userStats.max_text_length} characters. Your text is ${text.length} characters.`
            });
          }
          
          // Check daily usage limit
          const todayQuery = await db.query(
            'SELECT COUNT(*) as count FROM humanize_logs ' +
            'WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'24 hours\'',
            [userId]
          );
          
          const todayCount = parseInt(todayQuery.rows[0].count);
          
          if (todayCount >= userStats.daily_limit) {
            return res.status(429).json({
              error: 'Usage limit exceeded',
              message: `You have reached your daily limit of ${userStats.daily_limit} humanizations. Please try again tomorrow or upgrade your plan.`
            });
          }
        }
      } catch (dbError) {
        console.error('Error checking usage limits:', dbError);
        // Continue with humanization despite error checking limits
      }
    }
    
    // Forward request to the real humanizer API
    // Make sure we're using the correct endpoint
    const apiUrl = `${HUMANIZER_API_URL}${HUMANIZE_TEXT_ENDPOINT}`;
    console.log(`Sending request to: ${apiUrl}`);
    
    try {
      const response = await axios.post(apiUrl, {
        input_text: text
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('Humanizer API response:', response.status, response.statusText);
      console.log('Response data:', JSON.stringify(response.data).substring(0, 200) + '...');
      
      // Extract the result from the response
      const humanizedText = response.data.result || response.data.humanized_text || response.data.text;
      
      if (!humanizedText) {
        throw new Error('Humanizer API returned an invalid response: ' + JSON.stringify(response.data));
      }
      
      // Calculate processing time
      const processTime = Date.now() - startTime;
      
      // Log the humanization in the database
      try {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Parse AI score if provided
        let aiScoreValue = null;
        let humanScoreValue = null;
        
        if (aiScore) {
          aiScoreValue = parseInt(aiScore.ai_score) || null;
          humanScoreValue = parseInt(aiScore.human_score) || null;
        }
        
        // Insert log entry
        await db.query(
          'INSERT INTO humanize_logs ' +
          '(user_id, original_text, humanized_text, text_length, ai_score, human_score, ip_address, user_agent, process_time_ms) ' +
          'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            userId, 
            text, 
            humanizedText, 
            text.length, 
            aiScoreValue, 
            humanScoreValue, 
            ipAddress, 
            userAgent, 
            processTime
          ]
        );
        
        // Update usage statistics if user is logged in
        if (userId) {
          await db.query(
            'UPDATE humanize_usage_statistics ' +
            'SET total_uses = total_uses + 1, ' +
            'total_characters = total_characters + $1, ' +
            'avg_ai_score = CASE WHEN $2 IS NULL THEN avg_ai_score ELSE (avg_ai_score * total_uses + $2) / (total_uses + 1) END, ' +
            'last_used_at = NOW(), ' +
            'updated_at = NOW() ' +
            'WHERE user_id = $3',
            [text.length, aiScoreValue, userId]
          );
        }
      } catch (logError) {
        console.error('Error logging humanization:', logError);
        // Continue despite logging error
      }
      
      // Return the humanized text to the client
      res.json({
        original: text,
        humanized: humanizedText,
        stats: {
          characters: text.length,
          processing_time_ms: processTime
        }
      });
      
    } catch (apiError) {
      console.error('Error calling humanizer API:', apiError);
      
      // Check for specific error types and provide helpful messages
      if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ENOTFOUND') {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'The humanization service is currently unreachable. Please try again later.',
          details: 'Connection to the humanizer API failed'
        });
      }
      
      if (apiError.code === 'ETIMEDOUT' || apiError.code === 'ESOCKETTIMEDOUT') {
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'The humanization service took too long to respond. Please try again with a shorter text.',
          details: 'Request to the humanizer API timed out'
        });
      }
      
      // If we have a response from the API but it's an error
      if (apiError.response) {
        return res.status(apiError.response.status).json({
          error: 'Humanization Failed',
          message: 'The humanization service returned an error.',
          details: apiError.response.data || apiError.message
        });
      }
      
      // Generic error fallback
      return res.status(500).json({
        error: 'Humanization Failed',
        message: 'An error occurred during text humanization. Please try again later.',
        details: apiError.message
      });
    }
    
  } catch (error) {
    console.error('Humanize error:', error);
    res.status(500).json({
      error: 'Humanization failed',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

/**
 * Get usage statistics for the current user
 */
router.get('/stats', async (req, res) => {
  try {
    // Get authenticated user
    let user;
    try {
      user = await getSessionUser(req);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in to view usage statistics'
        });
      }
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed: ' + authError.message
      });
    }
    
    // Get user's usage statistics
    const statsQuery = await db.query(
      'SELECT us.*, ul.daily_limit, ul.max_text_length FROM humanize_usage_statistics us ' +
      'LEFT JOIN humanize_usage_limits ul ON ul.tier_name = COALESCE(' +
      '  (SELECT tier FROM users WHERE id = $1), ' +
      '  \'free\'' +
      ') ' +
      'WHERE us.user_id = $1',
      [user.id]
    );
    
    if (statsQuery.rows.length === 0) {
      // No statistics yet, get default limits
      const limitsQuery = await db.query(
        'SELECT * FROM humanize_usage_limits WHERE tier_name = $1',
        ['free'] // Default to free tier
      );
      
      return res.json({
        usage: {
          total_uses: 0,
          total_characters: 0,
          avg_ai_score: 0,
          last_used_at: null
        },
        limits: limitsQuery.rows[0] || {
          daily_limit: 5,
          max_text_length: 5000
        },
        today_uses: 0
      });
    }
    
    // Get today's usage count
    const todayQuery = await db.query(
      'SELECT COUNT(*) as count FROM humanize_logs ' +
      'WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'24 hours\'',
      [user.id]
    );
    
    const userStats = statsQuery.rows[0];
    const todayCount = parseInt(todayQuery.rows[0].count);
    
    res.json({
      usage: {
        total_uses: userStats.total_uses,
        total_characters: userStats.total_characters,
        avg_ai_score: userStats.avg_ai_score,
        last_used_at: userStats.last_used_at
      },
      limits: {
        daily_limit: userStats.daily_limit,
        max_text_length: userStats.max_text_length
      },
      today_uses: todayCount
    });
    
  } catch (error) {
    console.error('Error getting usage statistics:', error);
    res.status(500).json({
      error: 'Failed to retrieve usage statistics',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

/**
 * Get history of humanizations for the current user
 */
router.get('/history', async (req, res) => {
  try {
    // Get authenticated user
    let user;
    try {
      user = await getSessionUser(req);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in to view history'
        });
      }
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed: ' + authError.message
      });
    }
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get total count
    const countQuery = await db.query(
      'SELECT COUNT(*) as total FROM humanize_logs WHERE user_id = $1',
      [user.id]
    );
    
    const total = parseInt(countQuery.rows[0].total);
    
    // Get history entries
    const historyQuery = await db.query(
      'SELECT id, original_text, humanized_text, text_length, ai_score, human_score, process_time_ms, created_at ' +
      'FROM humanize_logs ' +
      'WHERE user_id = $1 ' +
      'ORDER BY created_at DESC ' +
      'LIMIT $2 OFFSET $3',
      [user.id, limit, offset]
    );
    
    res.json({
      history: historyQuery.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error getting humanization history:', error);
    res.status(500).json({
      error: 'Failed to retrieve humanization history',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Simple health check for this service
router.get('/health', (req, res) => {
  // Log which URL we're using for the humanizer API
  console.log(`Checking humanizer API health at: ${HUMANIZER_API_URL}/health`);
  
  // Test the humanizer API
  axios.get(`${HUMANIZER_API_URL}/health`, { timeout: 5000 })
    .then(response => {
      res.json({
        status: 'healthy',
        database: db.hasConnection ? 'connected' : 'disconnected',
        humanizer: {
          status: 'available',
          url: HUMANIZER_API_URL
        },
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      console.error('Error checking humanizer API health:', error.message);
      res.json({
        status: 'degraded',
        database: db.hasConnection ? 'connected' : 'disconnected',
        humanizer: {
          status: 'unavailable',
          error: error.message,
          url: HUMANIZER_API_URL
        },
        timestamp: new Date().toISOString()
      });
    });
});

module.exports = router;
