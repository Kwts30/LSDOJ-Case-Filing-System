const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

let db = null;

// SESSIONS Model - Maps to ERD sessions collection
const Session = {
  setDB(database) {
    db = database;
  },

  async create(sessionData) {
    if (!db) throw new Error('Database not connected');

    const {
      user_id,
      token,
      expires_at,
      ip_address = '',
      user_agent = '',
      metadata = {}
    } = sessionData;

    const newSession = {
      user_id: new ObjectId(user_id),
      token,
      expires_at: new Date(expires_at),
      ip_address,
      user_agent,
      metadata,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true
    };

    const result = await db.collection('sessions').insertOne(newSession);
    return { _id: result.insertedId, ...newSession };
  },

  async findByToken(token) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('sessions').findOne({
      token,
      is_active: true,
      expires_at: { $gt: new Date() }
    });
  },

  async findByUserId(user_id) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('sessions')
      .find({
        user_id: new ObjectId(user_id),
        is_active: true,
        expires_at: { $gt: new Date() }
      })
      .sort({ created_at: -1 })
      .toArray();
  },

  async invalidate(token) {
    if (!db) throw new Error('Database not connected');

    await db.collection('sessions').updateOne(
      { token },
      {
        $set: { is_active: false },
        $currentDate: { updated_at: true }
      }
    );
  },

  async invalidateByUserId(user_id) {
    if (!db) throw new Error('Database not connected');

    const result = await db.collection('sessions').updateMany(
      { user_id: new ObjectId(user_id) },
      {
        $set: { is_active: false },
        $currentDate: { updated_at: true }
      }
    );
    return result.modifiedCount;
  },

  async findById(sessionId) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('sessions').findOne({
      _id: new ObjectId(sessionId)
    });
  },

  async cleanupExpired() {
    if (!db) throw new Error('Database not connected');

    const result = await db.collection('sessions').deleteMany({
      expires_at: { $lt: new Date() }
    });
    return result.deletedCount;
  },

  async getAllActiveSessions(user_id) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('sessions')
      .find({
        user_id: new ObjectId(user_id),
        is_active: true
      })
      .sort({ created_at: -1 })
      .toArray();
  }
};

module.exports = Session;
