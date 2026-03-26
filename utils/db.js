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
      tls: false  // Disable TLS for local development
    });
    await client.connect();
    db = client.db('doj-auto-fillup');
    console.log('✓ Connected to MongoDB Atlas');

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
    }

    if (!collectionNames.includes('generated_documents')) {
      await db.createCollection('generated_documents');
      await db.collection('generated_documents').createIndex({ userId: 1 });
      await db.collection('generated_documents').createIndex({ createdAt: 1 });
      await db.collection('generated_documents').createIndex({ documentType: 1 });
    }

    if (!collectionNames.includes('activity_logs')) {
      await db.createCollection('activity_logs');
      await db.collection('activity_logs').createIndex({ userId: 1 });
      await db.collection('activity_logs').createIndex({ timestamp: 1 });
      await db.collection('activity_logs').createIndex({ action: 1 });
      // TTL index: auto-delete logs after 90 days
      await db.collection('activity_logs').createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });
    }

    if (!collectionNames.includes('rate_limit')) {
      await db.createCollection('rate_limit');
      await db.collection('rate_limit').createIndex('createdAt', { expireAfterSeconds: 3600 });
      await db.collection('rate_limit').createIndex({ identifier: 1 });
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
