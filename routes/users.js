// User management routes - admin only

const express = require('express');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');
const { hashPassword, logActivity } = require('../middleware/auth');

// GET /admin/users - List all users
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const users = await db.collection('users')
      .find()
      .sort({ created_at: -1 })
      .toArray();

    res.render('admin/users', {
      title: 'User Management',
      users,
      user: req.session
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).render('error', { message: 'Failed to load users' });
  }
});

// GET /admin/users/add - Render add user page
router.get('/add', async (req, res) => {
  try {
    res.render('admin/user-add', {
      title: 'Add User',
      user: req.session
    });
  } catch (error) {
    console.error('Add user page error:', error);
    res.status(500).render('error', { message: 'Failed to load add user page' });
  }
});

// GET /admin/users/:id - View user details
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!user) {
      return res.status(404).render('error', { message: 'User not found' });
    }

    res.render('admin/user-edit', {
      title: 'Edit User',
      editUser: user,
      user: req.session
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).render('error', { message: 'Failed to load user' });
  }
});

// PUT /admin/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { first_name, last_name, firstName, lastName, email, role, is_active, isActive } = req.body;

    const normalizedFirstName = first_name !== undefined ? first_name : firstName;
    const normalizedLastName = last_name !== undefined ? last_name : lastName;
    const normalizedIsActive = is_active !== undefined ? is_active : isActive;

    const updateData = {
      first_name: normalizedFirstName || '',
      last_name: normalizedLastName || '',
      email,
      role,
      is_active: normalizedIsActive === 'true' || normalizedIsActive === true,
      updated_at: new Date()
    };

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log activity
    await logActivity(new ObjectId(req.session.userId), 'edit_user', `Edited user ${email}`);

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /admin/users - Create new user
router.post('/', async (req, res) => {
  try {
    const db = getDatabase();
    const { username, email, password, first_name, last_name, firstName, lastName, role } = req.body;

    const normalizedFirstName = first_name !== undefined ? first_name : firstName;
    const normalizedLastName = last_name !== undefined ? last_name : lastName;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Username, email, and password are required'
      });
    }

    // Check if username or email already exists
    const existing = await db.collection('users').findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existing) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'Username or email is already in use'
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const newUser = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password_hash,
      role: role || 'user',
      first_name: normalizedFirstName || '',
      last_name: normalizedLastName || '',
      is_active: true,
      last_login: null,
      login_attempts: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    // Log activity
    await logActivity(new ObjectId(req.session.userId), 'create_user', `Created user ${username}`);

    res.json({
      success: true,
      message: 'User created successfully',
      user_id: result.insertedId
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// DELETE /admin/users/:id - Soft delete user
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { is_active: false, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log activity
    await logActivity(new ObjectId(req.session.userId), 'delete_user', `Deactivated user ${req.params.id}`);

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

module.exports = router;
