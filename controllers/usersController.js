const { getDatabase, ObjectId } = require('../utils/db');
const { hashPassword, logActivity } = require('../middleware/auth');
const { DEPARTMENTS, POSITIONS, ADMIN_ROLES, ACCOUNT_STATUSES, ACCOUNT_STATUS_DISPLAY } = require('../config/constants');
const { getActor, isSuperAdmin, canManageUser } = require('../utils/accessControl');
const { validatePasswordPolicy } = require('../utils/passwordPolicy');

exports.getUsers = async (req, res) => {
  try {
    const db = getDatabase();
    const actor = getActor(req);
    const isSuper = isSuperAdmin(actor);
    const adminDept = actor.department;

    const filter = {};
    if (!isSuper) {
      filter.department = adminDept;
    } else if (req.query.department && DEPARTMENTS.includes(req.query.department)) {
      filter.department = req.query.department;
    }
    if (req.query.status) {
      filter.account_status = req.query.status;
    }

    const users = await db.collection('users')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();

    res.render('admin/users', {
      title: 'User Management - Admin',
      currentPage: 'admin-users',
      users,
      isSuperAdmin: isSuper,
      adminDept,
      DEPARTMENTS,
      ACCOUNT_STATUS_DISPLAY,
      filterDept: req.query.department || '',
      filterStatus: req.query.status || ''
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).render('error', { message: 'Failed to load users' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const db = getDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    if (!canManageUser(getActor(req), user)) {
      return res.status(403).render('error', { message: 'You can only manage users in your department' });
    }

    // Resolve verified_by
    let verifier = null;
    if (user.verified_by) {
      verifier = await db.collection('users').findOne({ _id: user.verified_by });
    }

    res.render('admin/user-edit', {
      title: `Edit User ${user.username} - Admin`,
      currentPage: 'admin-users',
      editUser: user,
      verifier,
      DEPARTMENTS,
      POSITIONS,
      ADMIN_ROLES: Object.values(ADMIN_ROLES),
      ACCOUNT_STATUSES: Object.values(ACCOUNT_STATUSES)
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).render('error', { message: 'Failed to load user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const db = getDatabase();
    const { name, email, department, position, admin_role, account_status } = req.body;
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    const actor = getActor(req);
    const isSuper = isSuperAdmin(actor);
    if (!canManageUser(actor, targetUser)) return res.status(403).json({ error: 'You can only manage users in your department' });
    if (!isSuper) {
      if (department !== undefined && department !== targetUser.department) {
        return res.status(403).json({ error: 'Only a super administrator may change the department of a user' });
      }
      if (admin_role !== undefined && admin_role !== targetUser.admin_role) {
        return res.status(403).json({ error: 'Only a super administrator may change administrative roles' });
      }
    }
    const effectiveDepartment = department || targetUser.department;
    if (department !== undefined && !DEPARTMENTS.includes(department)) return res.status(400).json({ error: 'Invalid department' });
    if (position !== undefined && (!POSITIONS[effectiveDepartment] || !POSITIONS[effectiveDepartment].includes(position))) return res.status(400).json({ error: 'Invalid position for department' });
    if (admin_role !== undefined && !Object.values(ADMIN_ROLES).includes(admin_role)) return res.status(400).json({ error: 'Invalid administrative role' });
    if (account_status !== undefined && !Object.values(ACCOUNT_STATUSES).includes(account_status)) return res.status(400).json({ error: 'Invalid account status' });

    const updateData = {
      updated_at: new Date()
    };

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null;
    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    if (admin_role !== undefined) updateData.admin_role = admin_role;
    if (account_status !== undefined) updateData.account_status = account_status;

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    await logActivity(
      new ObjectId(req.session.userId), 'edit',
      `Updated user ${req.params.id}`,
      'account', req.params.id, req
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const db = getDatabase();
    const { username, name, password, department, position, admin_role } = req.body;
    const actor = getActor(req);
    const isSuper = isSuperAdmin(actor);

    if (!username || !name || !password || !department || !position) {
      return res.status(400).json({ error: 'Username, name, password, department, and position are required' });
    }
    if (!DEPARTMENTS.includes(department) || !POSITIONS[department]?.includes(position)) {
      return res.status(400).json({ error: 'Invalid department or position' });
    }
    if (!isSuper && department !== actor.department) {
      return res.status(403).json({ error: 'You can only create users in your department' });
    }
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    if (admin_role !== undefined && (!isSuper || !Object.values(ADMIN_ROLES).includes(admin_role))) {
      return res.status(403).json({ error: 'Only a super administrator may assign administrative roles' });
    }

    // Check if username exists
    const existing = await db.collection('users').findOne({
      username: username.toUpperCase()
    });

    if (existing) {
      return res.status(400).json({ error: 'Username already registered' });
    }

    const password_hash = await hashPassword(password);

    const newUser = {
      username: username.toUpperCase(),
      name,
      password_hash,
      department,
      position,
      account_status: 'active', // Admin-created accounts are active immediately
      admin_role: isSuper ? (admin_role || 'none') : 'none',
      verified_by: new ObjectId(req.session.userId),
      rejection_reason: null,
      email: null,
      last_login: null,
      login_attempts: 0,
      login_locked_until: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    await logActivity(
      new ObjectId(req.session.userId), 'create',
      `Created user ${username} (${department} - ${position})`,
      'account', result.insertedId.toString(), req
    );

    res.json({ success: true, message: 'User created successfully', user_id: result.insertedId });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const db = getDatabase();

    // Prevent self-deactivation
    if (req.params.id === req.session.userId) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (!canManageUser(getActor(req), targetUser)) return res.status(403).json({ error: 'You can only manage users in your department' });

    if (req.query.hard === 'true') {
      if (targetUser.account_status === 'active' || targetUser.account_status === 'pending') {
        return res.status(400).json({ error: 'Cannot permanently delete an active or pending account. Deactivate it first.' });
      }
      
      const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      await logActivity(
        new ObjectId(req.session.userId), 'delete',
        `Permanently deleted user ${targetUser.username}`,
        'account', req.params.id, req
      );

      return res.json({ success: true, message: 'User permanently deleted' });
    }

    // Soft delete (deactivate)
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          account_status: 'rejected',
          rejection_reason: 'Deactivated by administrator',
          verified_by: new ObjectId(req.session.userId)
        },
        $currentDate: { updated_at: true }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logActivity(
      new ObjectId(req.session.userId), 'delete',
      `Deactivated user ${req.params.id}`,
      'account', req.params.id, req
    );

    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('User deactivation error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};
