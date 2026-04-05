// Authentication routes - login, logout, profile

const express = require('express');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');
const { verifyPassword, hashPassword, logActivity, generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

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

    let user = await db.collection('users').findOne({
      username: username.toLowerCase(),
      $or: [{ is_active: true }, { isActive: true }]
    });

    // Auto-bootstrap admin from .env on first login if database is empty
    if (!user) {
      const adminUsername = (process.env.ADMIN_USERNAME || 'kdelosreyes').toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD || '12345678';

      if (username.toLowerCase() === adminUsername && password === adminPassword) {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);
        const created = {
          username: adminUsername,
          email: process.env.ADMIN_EMAIL || 'admin@dojsystem.local',
          password_hash,
          role: 'admin',
          first_name: 'Admin',
          last_name: 'Account',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };
        const result = await db.collection('users').insertOne(created);
        user = { _id: result.insertedId, ...created };
      }
    }

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).render('login', {
        title: 'Login - DOJ System',
        error: 'Invalid username or password',
        isAuthenticated: false
      });
    }

    // Verify password
    const hash = user.password_hash || user.passwordHash;
    const isPasswordValid = await verifyPassword(password, hash);

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
      { $set: { last_login: new Date(), is_active: true } }
    );

    // Set session
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;
    req.session.firstName = user.first_name || user.firstName || '';
    req.session.lastName = user.last_name || user.lastName || '';

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
      role: req.session.userRole,
      department: req.session.department || ''
    }
  });
});

// POST /auth/profile/update - Update user profile
router.post('/profile/update', async (req, res) => {
  try {
    console.log('Profile update request received');
    console.log('Session userId:', req.session?.userId);
    console.log('Request body:', req.body);

    if (!req.session || !req.session.userId) {
      console.log('Not authenticated - no session or userId');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { firstName, lastName, email, department } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    console.log('Updating profile for user:', req.session.userId);

    const db = getDatabase();
    const userId = new ObjectId(req.session.userId);

    // Check if email is already taken by another user
    const existingUser = await db.collection('users').findOne({
      email: email.toLowerCase(),
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use by another user' });
    }

    // Update user profile
    const updateData = {
      first_name: firstName,
      last_name: lastName,
      email: email.toLowerCase(),
      department: department || '',
      updated_at: new Date()
    };

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    console.log('Update result:', result);

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    // Update session data
    req.session.firstName = firstName;
    req.session.lastName = lastName;
    req.session.userEmail = email.toLowerCase();
    req.session.department = department || '';

    // Log activity
    await logActivity(userId, 'update_profile', `Updated profile information`);

    console.log('Profile updated successfully for user:', req.session.userId);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        firstName,
        lastName,
        email,
        department
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to update profile: ' + error.message });
  }
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
