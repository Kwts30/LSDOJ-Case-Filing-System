const MongoStore = require('connect-mongo');

/**
 * Creates a MongoDB-backed session store using connect-mongo.
 * Falls back to an in-memory store when db._collections is set (test mode).
 *
 * @param {import('mongodb').Db} db - Active MongoDB Db instance
 * @returns {session.Store}
 */
function createSessionStore() {
  const session = require('express-session');
  
  // Test / memory-db fallback (used in unit tests)
  if (process.env.NODE_ENV === 'test') {
    return new session.MemoryStore();
  }

  return MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: 'doj-case-filing',
    collectionName: 'app_sessions',
    stringify: false, // store sessions as native BSON objects
    ttl: parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10) / 1000,
    autoRemove: 'native', 
    touchAfter: 60 
  });
}

module.exports = { createSessionStore };
