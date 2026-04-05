// Database connection and models initialization

const { MongoClient, ObjectId } = require('mongodb');

let db = null;
let client = null;

// Initialize database connection
async function initializeDatabase(mongoUri) {
  if (db) return db;

  try {
    console.log('Attempting to connect to MongoDB...');
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      retryWrites: true,
      // TLS is automatically enabled for mongodb+srv:// URIs
      tls: mongoUri.includes('mongodb+srv') ? true : false
    });
    await client.connect();
    await client.db('admin').command({ ping: 1 }); // Test connection
    db = client.db('doj-auto-fillup');
    console.log('✓ Connected to MongoDB Atlas');

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // USERS Collection
    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
    }

    // SESSIONS Collection (for JWT tokens & auth sessions)
    if (!collectionNames.includes('sessions')) {
      await db.createCollection('sessions');
      await db.collection('sessions').createIndex({ user_id: 1 });
      await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
      await db.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    }

    // DOCUMENTS Collection
    if (!collectionNames.includes('documents')) {
      await db.createCollection('documents');
      await db.collection('documents').createIndex({ user_id: 1 });
      await db.collection('documents').createIndex({ created_at: 1 });
      await db.collection('documents').createIndex({ doc_type: 1 });
    }

    // AUDIT_LOGS Collection (activity tracking)
    if (!collectionNames.includes('audit_logs')) {
      await db.createCollection('audit_logs');
      await db.collection('audit_logs').createIndex({ user_id: 1 });
      await db.collection('audit_logs').createIndex({ action: 1 });
      // TTL index: auto-delete logs after 90 days
      try {
        await db.collection('audit_logs').dropIndex('timestamp_1').catch(() => {});
      } catch (e) {}
      await db.collection('audit_logs').createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });
    } else {
      // Ensure TTL index exists on existing collection
      try {
        const indexes = await db.collection('audit_logs').listIndexes().toArray();
        const hasTTL = indexes.some(idx => idx.expireAfterSeconds >= 7776000);
        if (!hasTTL) {
          try {
            await db.collection('audit_logs').dropIndex('timestamp_1').catch(() => {});
            await db.collection('audit_logs').createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });
          } catch (e) {}
        }
      } catch (e) {}
    }

    // RATE_LIMIT Collection (internal utility for rate limiting)
    if (!collectionNames.includes('rate_limit')) {
      await db.createCollection('rate_limit');
      await db.collection('rate_limit').createIndex({ identifier: 1 });
      await db.collection('rate_limit').createIndex({ created_at: 1 }, { expireAfterSeconds: 3600 });
    }

    return db;
  } catch (mongoError) {
    console.warn('⚠️  MongoDB connection failed:', mongoError.message);
    console.log('📝 Using in-memory database for development...\n');

    // Fallback to in-memory database
    const MemoryDB = require('./memoryDb');
    db = MemoryDB;

    // Initialize collections
    await db.createCollection('users');
    await db.createCollection('generated_documents');
    await db.createCollection('activity_logs');
    await db.createCollection('rate_limit');

    console.log('✓ In-memory database initialized');
    console.log('⚠️  Note: Data will be lost when the server restarts\n');

    return db;
  }
}

// Get database instance
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

// Close database connection
async function closeDatabase() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  ObjectId
};
