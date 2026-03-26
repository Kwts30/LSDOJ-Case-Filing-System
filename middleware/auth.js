// Authentication and authorization middleware

const jwt = require('jsonwebtoken');
const { getDatabase } = require('../utils/db');

// Authenticate user - check session or JWT token
async function authenticateUser(req, res, next) {
  try {
    // Check if user is in session
    if (req.session && req.session.userId) {
      // User already authenticated via session
      return next();
    }

    // Check for JWT token in Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      req.user = { _id: decoded.userId, role: decoded.role };
      return next();
    }

    // No authentication found, redirect to login
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please login first' });
    }

    return res.redirect('/auth/login');
  } catch (error) {
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Invalid token', message: error.message });
    }
    return res.redirect('/auth/login');
  }
}

// Require specific role
function requireRole(role) {
  return async (req, res, next) => {
    try {
      let userRole = req.session?.userRole;

      // If no session, try JWT
      if (!userRole && req.headers['authorization']) {
        const authHeader = req.headers['authorization'];
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          userRole = decoded.role;
        }
      }

      if (!userRole) {
        if (req.path.startsWith('/api')) {
          return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
        }
        return res.status(403).render('error', { message: 'Access denied' });
      }

      // Check if user has required role
      if (userRole !== role && role !== 'any') {
        if (req.path.startsWith('/api')) {
          return res.status(403).json({ error: 'Forbidden', message: `${role} role required` });
        }
        return res.status(403).render('error', { message: 'Access denied' });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Log user activity
async function logActivity(userId, action, details = '') {
  try {
    const db = getDatabase();
    const activityCollection = db.collection('activity_logs');

    await activityCollection.insertOne({
      userId,
      action,
      details,
      result: 'success',
      ipAddress: '',
      userAgent: '',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Activity logging error:', error);
    // Don't throw - logging failure shouldn't break the app
  }
}

// Generate JWT token
function generateToken(userId, role) {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
}

// Verify password
async function verifyPassword(plainPassword, hash) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(plainPassword, hash);
}

// Hash password
async function hashPassword(password) {
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Set user context for EJS templates
async function setUserContext(req, res, next) {
  res.locals.isAuthenticated = !!(req.session && req.session.userId);
  res.locals.userId = req.session?.userId || null;
  res.locals.userRole = req.session?.userRole || null;
  res.locals.username = req.session?.username || null;
  next();
}

module.exports = {
  authenticateUser,
  requireRole,
  logActivity,
  generateToken,
  verifyPassword,
  hashPassword,
  setUserContext
};
