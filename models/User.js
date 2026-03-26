const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

let db = null;

const User = {
  setDB(database) {
    db = database;
  },

  async create(userData) {
    if (!db) throw new Error('Database not connected');

    const { username, email, password, firstName, lastName, department, role = 'user' } = userData;

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
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      role,
      firstName: firstName || '',
      lastName: lastName || '',
      department: department || '',
      isActive: true,
      lastLogin: null,
      loginAttempts: 0,
      jwtTokens: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);
    return { _id: result.insertedId, ...newUser, passwordHash: undefined };
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
    return await db.collection('users').find({ isActive: true }).toArray();
  },

  async verifyPassword(inputPassword, passwordHash) {
    return await bcrypt.compare(inputPassword, passwordHash);
  },

  async updateLastLogin(userId) {
    if (!db) throw new Error('Database not connected');
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { lastLogin: new Date(), loginAttempts: 0 },
        $currentDate: { updatedAt: true }
      }
    );
  },

  async updateUser(userId, updateData) {
    if (!db) throw new Error('Database not connected');

    const allowedFields = ['firstName', 'lastName', 'department', 'email'];
    const updates = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    updates.updatedAt = new Date();

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
        $set: { isActive: false },
        $currentDate: { updatedAt: true }
      }
    );
  },

  async changePassword(userId, newPassword) {
    if (!db) throw new Error('Database not connected');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { passwordHash },
        $currentDate: { updatedAt: true }
      }
    );
  }
};

module.exports = User;
