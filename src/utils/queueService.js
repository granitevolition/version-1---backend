const db = require('../db');
const { humanizeText } = require('./humanize');

/**
 * Queue Service for managing async humanization requests
 * This service manages adding requests to the queue and checking status
 */
class QueueService {
  /**
   * Add a new humanization request to the queue
   * 
   * @param {number} userId - User ID for the request
   * @param {string} text - Text to humanize
   * @param {number} wordCount - Word count for validation and tracking
   * @returns {Object} - Queue item with ID and status
   */
  static async addToQueue(userId, text, wordCount) {
    try {
      const result = await db.query(
        `INSERT INTO humanization_queue 
          (user_id, original_text, status, word_count) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, status, created_at`,
        [userId, text, 'pending', wordCount]
      );
      
      // Log the request for monitoring
      console.log(`[QUEUE] Added request ${result.rows[0].id} to queue for user ${userId} (${wordCount} words)`);
      
      return result.rows[0];
    } catch (error) {
      console.error('[QUEUE] Error adding to queue:', error);
      throw error;
    }
  }
  
  /**
   * Get the status of a queued request
   * 
   * @param {number} requestId - Queue item ID
   * @param {number} userId - User ID for security validation
   * @returns {Object} - Queue item with status and results if completed
   */
  static async getStatus(requestId, userId) {
    try {
      const result = await db.query(
        `SELECT 
          id, user_id, status, original_text, humanized_text, 
          created_at, updated_at, completed_at, error_message, attempts, word_count
        FROM humanization_queue 
        WHERE id = $1 AND user_id = $2`,
        [requestId, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Request not found or not authorized');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('[QUEUE] Error getting status:', error);
      throw error;
    }
  }
  
  /**
   * Get all requests for a user with pagination
   * 
   * @param {number} userId - User ID
   * @param {number} limit - Max number of items to return (default 10)
   * @param {number} offset - Offset for pagination (default 0)
   * @returns {Array} - Array of queue items
   */
  static async getUserRequests(userId, limit = 10, offset = 0) {
    try {
      const result = await db.query(
        `SELECT 
          id, status, original_text, humanized_text, 
          created_at, updated_at, completed_at, error_message, word_count
        FROM humanization_queue 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error('[QUEUE] Error getting user requests:', error);
      throw error;
    }
  }
  
  /**
   * Process the next pending item in the queue
   * This is called by the worker process
   * 
   * @returns {boolean} - True if an item was processed, false if queue was empty
   */
  static async processNextItem() {
    // Use a transaction to ensure we don't process the same item multiple times
    const client = await db.pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Get the next pending item with FOR UPDATE SKIP LOCKED to prevent race conditions
      const result = await client.query(
        `SELECT id, user_id, original_text, attempts, word_count
        FROM humanization_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`
      );
      
      // If no items found, return false
      if (result.rows.length === 0) {
        await client.query('COMMIT');
        return false;
      }
      
      const item = result.rows[0];
      console.log(`[QUEUE] Processing item ${item.id} (attempt ${item.attempts + 1})`);
      
      // Update the item status to processing and increment attempts
      await client.query(
        `UPDATE humanization_queue
        SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
        WHERE id = $1`,
        [item.id]
      );
      
      // Commit transaction - we now have exclusive access to this item
      await client.query('COMMIT');
      
      // Process the humanization request
      try {
        // Call the humanization API
        const humanizedText = await humanizeText(item.original_text);
        
        // Update the item with the result
        await db.query(
          `UPDATE humanization_queue
          SET status = 'completed', humanized_text = $1, 
              updated_at = NOW(), completed_at = NOW()
          WHERE id = $2`,
          [humanizedText, item.id]
        );
        
        console.log(`[QUEUE] Successfully processed item ${item.id}`);
        
        // Log usage for analytics and billing
        await db.query(
          'INSERT INTO humanize_usage (user_id, word_count, timestamp) VALUES ($1, $2, NOW())',
          [item.user_id, item.word_count]
        );
        
        return true;
      } catch (error) {
        console.error(`[QUEUE] Error processing item ${item.id}:`, error);
        
        // Check if this was the final attempt
        const maxAttempts = 3;
        const newStatus = item.attempts >= maxAttempts ? 'failed' : 'pending';
        
        // Update the item with error information
        await db.query(
          `UPDATE humanization_queue
          SET status = $1, error_message = $2, updated_at = NOW()
          WHERE id = $3`,
          [newStatus, error.message, item.id]
        );
        
        return true;
      }
    } catch (error) {
      // If any error occurs during the transaction, roll it back
      await client.query('ROLLBACK');
      console.error('[QUEUE] Transaction error:', error);
      return false;
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }
  
  /**
   * Retry a failed humanization request
   * 
   * @param {number} requestId - Queue item ID
   * @param {number} userId - User ID for security validation
   * @returns {Object} - Updated queue item
   */
  static async retryRequest(requestId, userId) {
    try {
      // Verify the request belongs to the user and is in a failed state
      const checkResult = await db.query(
        `SELECT id, status 
        FROM humanization_queue 
        WHERE id = $1 AND user_id = $2`,
        [requestId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('Request not found or not authorized');
      }
      
      const request = checkResult.rows[0];
      if (request.status !== 'failed') {
        throw new Error(`Cannot retry request with status: ${request.status}`);
      }
      
      // Reset the request to pending status
      const result = await db.query(
        `UPDATE humanization_queue
        SET status = 'pending', updated_at = NOW(), error_message = NULL
        WHERE id = $1
        RETURNING id, status, updated_at`,
        [requestId]
      );
      
      console.log(`[QUEUE] Request ${requestId} queued for retry by user ${userId}`);
      
      return result.rows[0];
    } catch (error) {
      console.error('[QUEUE] Error retrying request:', error);
      throw error;
    }
  }
  
  /**
   * Get queue statistics
   * 
   * @returns {Object} - Queue statistics
   */
  static async getStats() {
    try {
      const result = await db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time_seconds
        FROM humanization_queue
        GROUP BY status
      `);
      
      const totalResult = await db.query('SELECT COUNT(*) as total FROM humanization_queue');
      
      return {
        total: parseInt(totalResult.rows[0].total, 10),
        byStatus: result.rows.reduce((acc, row) => {
          acc[row.status] = {
            count: parseInt(row.count, 10),
            avgProcessingTimeSeconds: parseFloat(row.avg_processing_time_seconds || 0)
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('[QUEUE] Error getting stats:', error);
      throw error;
    }
  }
}

module.exports = QueueService;
