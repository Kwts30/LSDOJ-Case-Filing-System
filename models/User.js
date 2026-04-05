const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

let db = null;

// USERS Model - Maps to ERD users collection
const User = {
  setDB(database) {
    db = database;
  },

  async create(userData) {
    if (!db) throw new Error('Database not connected');

    const { username, email, password, first_name, last_name, department, role = 'user' } = userData;

    // Validate required fields
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }

    // Check if user already exists
    const existing = await db.collection('users').findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existing) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password_hash,
      role,
      first_name: first_name || '',
      last_name: last_name || '',
      department: department || '',
      is_active: true,
      last_login: null,
      login_attempts: 0,
      jwt_tokens: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);
    return { _id: result.insertedId, ...newUser, password_hash: undefined };
  },

  async findByUsername(username) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('users').findOne({ username: username.toLowerCase() });
  },

  async findById(userId) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('users').findOne({ _id: new ObjectId(userId) });
  },

  async findAll() {
    if (!db) throw new Error('Database not connected');
    return await db.collection('users').find({ is_active: true }).toArray();
  },

  async verifyPassword(inputPassword, password_hash) {
    return await bcrypt.compare(inputPassword, password_hash);
  },

  async updateLastLogin(userId) {
    if (!db) throw new Error('Database not connected');
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { last_login: new Date(), login_attempts: 0 },
        $currentDate: { updated_at: true }
      }
    );
  },

  async updateUser(userId, updateData) {
    if (!db) throw new Error('Database not connected');

    const allowedFields = ['first_name', 'last_name', 'department', 'email'];
    const updates = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    updates.updated_at = new Date();

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  },

  async softDeleteUser(userId) {
    if (!db) throw new Error('Database not connected');
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { is_active: false },
        $currentDate: { updated_at: true }
      }
    );
  },

  async changePassword(userId, newPassword) {
    if (!db) throw new Error('Database not connected');
    const password_hash = await bcrypt.hash(newPassword, 10);

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { password_hash },
        $currentDate: { updated_at: true }
      }
    );
  }
};

module.exports = User;
