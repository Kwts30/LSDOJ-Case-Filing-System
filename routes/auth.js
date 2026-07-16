// Authentication routes — login, signup, logout, profile
// LSPD / DOJ Case Filing System

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { getDatabase, ObjectId } = require('../utils/db');
const { verifyPassword, hashPassword, logActivity, generateToken } = require('../middleware/auth');
const { DEPARTMENTS, POSITIONS, ACCOUNT_STATUSES } = require('../config/constants');
const { validatePasswordPolicy } = require('../utils/passwordPolicy');
const { authRateLimitMiddleware } = require('../middleware/rateLimit');

const DUMMY_PASSWORD_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7vCw0JeS7G2wB.4D4x9fU6v0w9Fe91y';
const MAX_LOGIN_ATTEMPTS = Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
const LOGIN_LOCK_MS = Number.parseInt(process.env.LOGIN_LOCK_MS || String(15 * 60 * 1000), 10);

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

const signupSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(1, 'Password is required'),
  confirm_password: z.string().min(1, 'Confirm password is required'),
  department: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  badge_number: z.string().optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/login — Render login page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', {
    title: 'Login - Department of Justice Case Filing System',
    error: null,
    info: req.query.info || null
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login — Process login by username
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', authRateLimitMiddleware, async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).render('login', {
        title: 'Login - Department of Justice Case Filing System',
        error: 'Username and password are required',
        info: null
      });
    }
    const { username, password } = parseResult.data;

    const db = getDatabase();

    const user = await db.collection('users').findOne({
      username: username.trim().toUpperCase()
    });

    // Always run a bcrypt comparison, even for an unknown user. This makes
    // username enumeration through response time substantially harder.
    const isPasswordValid = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !isPasswordValid) {
      if (user) {
        const attempts = (Number(user.login_attempts) || 0) + 1;
        const update = { $set: {}, $inc: { login_attempts: 1 }, $currentDate: { updated_at: true } };
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          update.$set.login_locked_until = new Date(Date.now() + LOGIN_LOCK_MS);
        }
        await db.collection('users').updateOne({ _id: user._id }, update);
      }
      return res.status(401).render('login', {
        title: 'Login - Department of Justice Case Filing System',
        error: 'Invalid username or password',
        info: null
      });
    }

    const lockedUntil = user.login_locked_until ? new Date(user.login_locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return res.status(429).render('login', {
        title: 'Login - Department of Justice Case Filing System',
        error: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
        info: null
      });
    }

    // Account status is only disclosed after the password has been verified.
    if (user.account_status === 'pending') {
      return res.status(403).render('login', {
        title: 'Login - Department of Justice Case Filing System',
        error: null,
        info: 'Your account is pending verification by an administrator. Please check back later.'
      });
    }

    if (user.account_status === 'rejected') {
      const reason = user.rejection_reason ? ` Reason: ${user.rejection_reason}` : '';
      return res.status(403).render('login', {
        title: 'Login - Department of Justice Case Filing System',
        error: `Your account application was rejected.${reason} You may reapply with corrected information.`,
        info: null
      });
    }

    if (user.account_status === 'inactive') {
      return res.status(403).render('login', {
        title: 'Login - Department of Justice Case Filing System',
        error: null,
        info: 'Your account is not active. Please contact an administrator.'
      });
    }

    // Successful login — reset attempts, update last_login
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { last_login: new Date(), login_attempts: 0, login_locked_until: null }, $currentDate: { updated_at: true } }
    );

    // Regenerate session after authentication to prevent session fixation.
    await new Promise((resolve, reject) => req.session.regenerate(error => (error ? reject(error) : resolve())));
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.name = user.name;
    req.session.department = user.department;
    req.session.position = user.position;
    req.session.admin_role = user.admin_role;
    req.session.badge_number = user.badge_number || null;
    req.session.email = user.email || '';
    await new Promise((resolve, reject) => req.session.save(error => (error ? reject(error) : resolve())));

    // Log activity
    await logActivity(user._id, 'login', `${user.username} logged in`, 'account', user._id.toString(), req);

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', {
      title: 'Login - Department of Justice Case Filing System',
      error: 'An error occurred during login. Please try again.',
      info: null
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/signup — Render signup page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/signup', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('signup', {
    title: 'Sign Up - Department of Justice Case Filing System',
    error: null,
    departments: DEPARTMENTS,
    positions: POSITIONS
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signup — Create a new pending account
// ─────────────────────────────────────────────────────────────────────────────
router.post('/signup', authRateLimitMiddleware, async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: 'All fields are required and must be valid',
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }
    const { username, name, password, confirm_password, department, position, badge_number } = parseResult.data;

    // Validate specific requirement for LSPD
    if (department === 'LSPD' && !badge_number) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: 'Badge number is required for LSPD',
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }

    // Password confirmation
    if (password !== confirm_password) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: 'Passwords do not match',
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }

    // Password strength
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: passwordError,
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }

    // Validate department
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: 'Invalid department selected',
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }

    // Validate position belongs to selected department
    if (!POSITIONS[department] || !POSITIONS[department].includes(position)) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: 'Invalid position for selected department',
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }

    const db = getDatabase();

    // Check if username already exists
    const existing = await db.collection('users').findOne({
      username: username.toUpperCase()
    });

    if (existing) {
      return res.status(400).render('signup', {
        title: 'Sign Up - Department of Justice Case Filing System',
        error: 'This username is already registered',
        departments: DEPARTMENTS,
        positions: POSITIONS
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user with pending status
    const newUser = {
      username: username.toUpperCase(),
      name,
      password_hash,
      department,
      position,
      badge_number: department === 'LSPD' ? badge_number : null,
      account_status: 'pending',
      admin_role: 'none',
      verified_by: null,
      rejection_reason: null,
      email: null,
      last_login: null,
      login_attempts: 0,
      login_locked_until: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    // Log signup
    await logActivity(result.insertedId, 'signup', `${username} signed up (${department} - ${position})`, 'account', result.insertedId.toString(), req);

    // Redirect to login with success message
    res.redirect('/login?info=Your account has been submitted for verification. An administrator will review your application.');
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).render('signup', {
      title: 'Sign Up - Department of Justice Case Filing System',
      error: 'An error occurred during registration. Please try again.',
      departments: DEPARTMENTS,
      positions: POSITIONS
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  if (req.session && req.session.userId) {
    const userId = new ObjectId(req.session.userId);
    const username = req.session.username;
    logActivity(userId, 'logout', `${username} logged out`, 'account', userId.toString(), req);

    req.session.destroy((err) => {
      res.clearCookie(process.env.SESSION_COOKIE_NAME || 'filing.sid');
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/profile — View user profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  res.render('profile', {
    title: 'Profile - Department of Justice Case Filing System',
    user: {
      username: req.session.username,
      name: req.session.name,
      email: req.session.email,
      department: req.session.department,
      position: req.session.position,
      admin_role: req.session.admin_role
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/profile/update — Update profile
// ─────────────────────────────────────────────────────────────────────────────
router.post('/profile/update', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = getDatabase();
    const userId = new ObjectId(req.session.userId);

    const updateData = {
      name,
      email: email ? email.toLowerCase() : null,
      updated_at: new Date()
    };

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update session
    req.session.name = name;
    req.session.email = email ? email.toLowerCase() : '';

    await logActivity(userId, 'edit', 'Updated profile', 'account', userId.toString(), req);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/change-password — Change own password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/change-password', authRateLimitMiddleware, async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const passwordError = validatePasswordPolicy(new_password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const db = getDatabase();
    const userId = new ObjectId(req.session.userId);
    const user = await db.collection('users').findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await verifyPassword(current_password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update
    const password_hash = await hashPassword(new_password);
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { password_hash }, $currentDate: { updated_at: true } }
    );

    await logActivity(userId, 'edit', 'Changed password', 'account', userId.toString(), req);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-password — Re-verify password for e-signature
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-password', authRateLimitMiddleware, async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const db = getDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(req.session.userId)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await verifyPassword(password, user.password_hash);

    res.json({ verified: isValid });
  } catch (error) {
    console.error('Password verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/token — Generate JWT token for API access
// ─────────────────────────────────────────────────────────────────────────────
router.post('/token', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated. Please login first.' });
  }

  try {
    const token = generateToken(
      req.session.userId,
      req.session.department,
      req.session.position,
      req.session.admin_role
    );
    res.json({
      success: true,
      token,
      expiresIn: process.env.JWT_EXPIRY || '7d'
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

module.exports = router;
