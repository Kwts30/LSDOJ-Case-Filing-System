// Authentication and authorization middleware
// LSPD / DOJ Case Filing System — department-scoped RBAC

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDatabase, ObjectId } = require('../utils/db');
const { ADMIN_ROLES } = require('../config/constants');
const { jwtSecret } = require('../config/runtime');
const { minimumLength } = require('../utils/passwordPolicy');

/**
 * Authenticate user — check session or JWT token
 * Rejects users with account_status !== 'active'
 */
async function authenticateUser(req, res, next) {
  try {
    // Check session-based auth
    if (req.session && req.session.userId) {
      const db = getDatabase();
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(req.session.userId) },
        { projection: { account_status: 1, username: 1, name: 1, department: 1, position: 1, admin_role: 1, email: 1 } }
      );

      if (!user || user.account_status !== 'active') {
        await new Promise((resolve, reject) => {
          req.session.destroy((err) => (err ? reject(err) : resolve()));
        });

        if (req.path.startsWith('/api')) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Your account is not active. Please contact an administrator.'
          });
        }
        return res.redirect('/login?info=Your account is not active. Please contact an administrator.');
      }

      req.session.username = user.username;
      req.session.name = user.name;
      req.session.department = user.department;
      req.session.position = user.position;
      req.session.admin_role = user.admin_role;
      req.session.email = user.email || '';

      return next();
    }

    // Check JWT token in Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, jwtSecret);
      const db = getDatabase();
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(decoded.userId), account_status: 'active' },
        { projection: { department: 1, position: 1, admin_role: 1 } }
      );
      if (!user) throw new Error('Account is not active');
      req.user = {
        _id: user._id.toString(),
        department: user.department,
        position: user.position,
        admin_role: user.admin_role
      };
      return next();
    }

    // No auth found
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please login first' });
    }

    return res.redirect('/login');
  } catch (error) {
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication failed' });
    }
    return res.redirect('/login');
  }
}

/**
 * Require a specific department (LSPD or DOJ)
 */
function requireDepartment(...departments) {
  return (req, res, next) => {
    const userDept = req.session?.department || req.user?.department;
    const userAdminRole = req.session?.admin_role || req.user?.admin_role;

    // Super admins bypass department checks
    if (userAdminRole === ADMIN_ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!userDept || !departments.includes(userDept)) {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Department access denied' });
      }
      return res.status(403).render('error', { message: 'You do not have access to this section' });
    }

    next();
  };
}

/**
 * Require admin role (department_admin or super_admin)
 */
function requireAdminRole(...roles) {
  return (req, res, next) => {
    const userAdminRole = req.session?.admin_role || req.user?.admin_role;

    if (!userAdminRole || !roles.includes(userAdminRole)) {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
      }
      return res.status(403).render('error', { message: 'Admin access required' });
    }

    next();
  };
}

/**
 * Require specific position(s) — for DOJ role-specific routes
 */
function requirePosition(...positions) {
  return (req, res, next) => {
    const userPosition = req.session?.position || req.user?.position;
    const userAdminRole = req.session?.admin_role || req.user?.admin_role;

    // Super admins bypass position checks
    if (userAdminRole === ADMIN_ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!userPosition || !positions.includes(userPosition)) {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Insufficient position privileges' });
      }
      return res.status(403).render('error', { message: 'You do not have the required position for this action' });
    }

    next();
  };
}

/**
 * Legacy compatibility — requireRole (maps old 'admin' to new admin_role check)
 */
function requireRole(role) {
  return (req, res, next) => {
    const userAdminRole = req.session?.admin_role || req.user?.admin_role;

    if (role === 'admin') {
      if (userAdminRole === ADMIN_ROLES.DEPARTMENT_ADMIN || userAdminRole === ADMIN_ROLES.SUPER_ADMIN) {
        return next();
      }
    }

    if (req.path.startsWith('/api')) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
    return res.status(403).render('error', { message: 'Access denied' });
  };
}

/**
 * Log an audit event
 */
async function logActivity(actor, action, details = '', target_type = 'system', target_id = null, req = null) {
  try {
    const db = getDatabase();
    await db.collection('audit_logs').insertOne({
      actor,
      action,
      target_type,
      target_id,
      details,
      ip_address: req ? (req.ip || req.connection?.remoteAddress || '') : '',
      user_agent: req ? (req.get('user-agent') || '') : '',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Activity logging error:', error);
    // Don't throw — logging failure shouldn't break the app
  }
}

/**
 * Generate JWT token with department/position/admin_role claims
 */
function generateToken(userId, department, position, admin_role) {
  return jwt.sign(
    { userId, department, position, admin_role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
}

/**
 * Verify password against hash
 */
async function verifyPassword(plainPassword, hash) {
  return await bcrypt.compare(plainPassword, hash);
}

/**
 * Hash a password (bcrypt, work factor 12)
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

/**
 * Set user context for EJS templates
 * Exposes all role/department/position info to views
 */
async function setUserContext(req, res, next) {
  res.locals.passwordMinimumLength = minimumLength;
  res.locals.isAuthenticated = !!(req.session && req.session.userId);
  res.locals.userId = req.session?.userId || null;
  res.locals.name = req.session?.name || null;
  res.locals.username = req.session?.username || null;
  res.locals.department = req.session?.department || null;
  res.locals.position = req.session?.position || null;
  res.locals.admin_role = req.session?.admin_role || null;
  res.locals.badge_number = req.session?.badge_number || null;
  res.locals.userRole = req.session?.admin_role || 'none'; // backward compat for templates
  next();
}

module.exports = {
  authenticateUser,
  requireDepartment,
  requireAdminRole,
  requirePosition,
  requireRole,
  logActivity,
  generateToken,
  verifyPassword,
  hashPassword,
  setUserContext
};
