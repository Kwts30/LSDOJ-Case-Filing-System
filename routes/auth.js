// Authentication routes - login, logout, profile

const express = require('express');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');
const { verifyPassword, hashPassword, logActivity, generateToken } = require('../middleware/auth');

// GET /auth/login - Render login page
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', {
    title: 'Login - DOJ System',
    error: null
  });
});

// POST /auth/login - Process login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).render('login', {
        title: 'Login - DOJ System',
        error: 'Username and password are required',
        isAuthenticated: false
      });
    }

    const db = getDatabase();
    console.log('Attempting login for user:', username);

    const user = await db.collection('users').findOne({
      username: username.toLowerCase(),
      isActive: true
    });

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).render('login', {
        title: 'Login - DOJ System',
        error: 'Invalid username or password',
        isAuthenticated: false
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      console.log('Invalid password for user:', username);
      return res.status(401).render('login', {
        title: 'Login - DOJ System',
        error: 'Invalid username or password',
        isAuthenticated: false
      });
    }

    // Update last login
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Set session
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;
    req.session.firstName = user.firstName;
    req.session.lastName = user.lastName;

    // Log activity
    await logActivity(user._id, 'login', `User ${username} logged in`);

    console.log('Login successful for user:', username);

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).render('login', {
      title: 'Login - DOJ System',
      error: 'An error occurred during login: ' + error.message,
      isAuthenticated: false
    });
  }
});

// POST /auth/logout - Logout user
router.post('/logout', (req, res) => {
  if (req.session && req.session.userId) {
    const userId = new ObjectId(req.session.userId);
    logActivity(userId, 'logout', `User ${req.session.username} logged out`);

    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('/auth/login');
    });
  } else {
    res.redirect('/auth/login');
  }
});

// GET /auth/profile - View user profile
router.get('/profile', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  res.render('profile', {
    title: 'Profile - DOJ System',
    user: {
      username: req.session.username,
      email: req.session.userEmail,
      firstName: req.session.firstName,
      lastName: req.session.lastName,
      role: req.session.userRole
    }
  });
});

// POST /auth/token - Generate JWT token for API access
router.post('/token', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated. Please login first.' });
  }

  try {
    const token = generateToken(req.session.userId, req.session.userRole);
    res.json({
      success: true,
      token,
      expiresIn: process.env.JWT_EXPIRY || '7d',
      message: 'JWT token generated successfully. Use it in Authorization header: "Bearer <token>"'
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// POST /auth/refresh-token - Refresh JWT token
router.post('/refresh-token', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const newToken = generateToken(req.session.userId, req.session.userRole);
    res.json({
      success: true,
      token: newToken,
      expiresIn: process.env.JWT_EXPIRY || '7d'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
