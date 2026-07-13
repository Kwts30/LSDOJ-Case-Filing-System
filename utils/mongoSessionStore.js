const session = require('express-session');

class MongoSessionStore extends session.Store {
  constructor(db) {
    super();
    this.collection = db.collection('app_sessions');
    this.collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(error => {
      console.error('Session index setup error:', error);
    });
  }

  get(sid, callback) {
    this.collection.findOne({ _id: sid }).then(record => {
      if (!record || (record.expires_at && record.expires_at <= new Date())) return callback(null, null);
      return callback(null, record.session);
    }).catch(callback);
  }

  set(sid, sessionData, callback = () => {}) {
    const maxAge = sessionData.cookie?.maxAge;
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + (typeof maxAge === 'number' ? maxAge : 60 * 60 * 1000));
    this.collection.updateOne(
      { _id: sid },
      { $set: { session: sessionData, expires_at: expiresAt, updated_at: new Date() } },
      { upsert: true }
    ).then(() => callback(null)).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    this.collection.deleteOne({ _id: sid }).then(() => callback(null)).catch(callback);
  }

  touch(sid, sessionData, callback = () => {}) {
    const maxAge = sessionData.cookie?.maxAge || 60 * 60 * 1000;
    this.collection.updateOne(
      { _id: sid },
      { $set: { expires_at: new Date(Date.now() + maxAge), updated_at: new Date() } }
    ).then(() => callback(null)).catch(callback);
  }
}

function createSessionStore(db) {
  return db._collections ? new session.MemoryStore() : new MongoSessionStore(db);
}

module.exports = { createSessionStore };
