/**
 * Authentication utilities
 */
const db = require('../db');

/**
 * Get user from session token
 * @param {Object} req - Express request object
 * @returns {Promise<Object|null>} - User object or null if not authenticated
 */
const getSessionUser = async (req) => {
  try {
    // Check if authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return null;
    }
    
    // Check if sessions table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_sessions'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      throw new Error('Sessions table does not exist');
    }
    
    // Get user columns for dynamic query building
    const userColumns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users';
    `);
    
    const columnNames = userColumns.rows.map(row => row.column_name);
    
    // Build column selection part of the query
    let selectColumns = 'u.id, u.username';
    if (columnNames.includes('email')) {
      selectColumns += ', u.email';
    }
    if (columnNames.includes('phone')) {
      selectColumns += ', u.phone';
    }
    if (columnNames.includes('tier')) {
      selectColumns += ', u.tier';
    }
    
    // Query for user with valid session
    const result = await db.query(`
      SELECT ${selectColumns}
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = $1
      AND s.expires_at > NOW()
    `, [token]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting session user:', error);
    return null;
  }
};

/**
 * Authentication middleware for protected routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAuth = async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: error.message
    });
  }
};

module.exports = {
  getSessionUser,
  requireAuth
};
