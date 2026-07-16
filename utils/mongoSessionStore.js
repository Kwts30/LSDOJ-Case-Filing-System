const MongoStore = require('connect-mongo');

/**
 * Creates a MongoDB-backed session store using connect-mongo.
 * Falls back to an in-memory store when db._collections is set (test mode).
 *
 * @param {import('mongodb').Db} db - Active MongoDB Db instance
 * @returns {session.Store}
 */
function createSessionStore(db) {
  // Test / memory-db fallback (used in unit tests)
  if (db._collections) {
    const session = require('express-session');
    return new session.MemoryStore();
  }

  return MongoStore.create({
    client: db.client,
    dbName: db.databaseName,
    collectionName: 'app_sessions',
    stringify: false, // store sessions as native BSON objects (compatible with the old custom store format)
    ttl: parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10) / 1000, // convert ms → seconds
    autoRemove: 'native', // uses MongoDB TTL index
    touchAfter: 60 // only update session TTL once per minute to reduce writes
  });
}

module.exports = { createSessionStore };
