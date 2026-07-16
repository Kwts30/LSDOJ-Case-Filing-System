// Database connection and collection initialization
// LSPD / DOJ Case Filing System — fresh start (no legacy data migration)

const { MongoClient, ObjectId } = require('mongodb');

let db = null;
let client = null;

/**
 * Initialize database connection and set up all collections with indexes
 */
async function initializeDatabase(mongoUri) {
  if (db) return db;

  try {
    console.log('Attempting to connect to MongoDB...');
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      retryWrites: true,
      tls: mongoUri.includes('mongodb+srv') ? true : false
    });
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    db = client.db('doj-case-filing');
    // Expose client on db so connect-mongo can reuse the connection
    db.client = client;
    console.log('Connected to MongoDB Atlas');

    // Get existing collection names
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Drop only truly obsolete collections from the previous system.
    // Do NOT drop active collections like documents or generated_documents.
    const legacyCollections = ['activity_logs'];
    for (const col of legacyCollections) {
      if (collectionNames.includes(col)) {
        try {
          await db.collection(col).drop();
          console.log(`  Dropped legacy collection: ${col}`);
        } catch (e) {
          // Ignore errors on drop
        }
      }
    }

    // ───── USERS ─────
    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
    }
    try {
      await db.collection('users').dropIndex('badge_number_1');
      console.log('  Dropped legacy index: badge_number_1');
    } catch (e) {
      // Ignore if index does not exist
    }
    await ensureIndex(db, 'users', { username: 1 }, { unique: true });
    await ensureIndex(db, 'users', { department: 1 });
    await ensureIndex(db, 'users', { account_status: 1 });
    await ensureIndex(db, 'users', { admin_role: 1 });

    // ───── FILINGS ─────
    if (!collectionNames.includes('filings')) {
      await db.createCollection('filings');
    }
    await ensureIndex(db, 'filings', { filing_number: 1 }, { unique: true });
    await ensureIndex(db, 'filings', { status: 1 });
    await ensureIndex(db, 'filings', { submitted_by: 1 });
    await ensureIndex(db, 'filings', { da_reviewer: 1 });
    await ensureIndex(db, 'filings', { created_at: 1 });
    await ensureIndex(db, 'filings', { updated_at: 1 });

    // Atomic daily filing-number counters
    if (!collectionNames.includes('filing_sequences')) {
      await db.createCollection('filing_sequences');
    }

    // ───── ATTACHMENTS ─────
    if (!collectionNames.includes('attachments')) {
      await db.createCollection('attachments');
    }
    await ensureIndex(db, 'attachments', { filing_number: 1 });
    await ensureIndex(db, 'attachments', { uploaded_by: 1 });

    // ───── PROSECUTION RECORDS ─────
    if (!collectionNames.includes('prosecution_records')) {
      await db.createCollection('prosecution_records');
    }
    await ensureIndex(db, 'prosecution_records', { filing_number: 1 });

    // ───── GENERATED DOCUMENTS ─────
    if (!collectionNames.includes('generated_documents')) {
      await db.createCollection('generated_documents');
    }
    await ensureIndex(db, 'generated_documents', { filing_number: 1 });
    await ensureIndex(db, 'generated_documents', { filing_number: 1, version: -1 });

    // ───── TIMELINE ENTRIES ─────
    if (!collectionNames.includes('timeline_entries')) {
      await db.createCollection('timeline_entries');
    }
    await ensureIndex(db, 'timeline_entries', { filing_number: 1 });
    await ensureIndex(db, 'timeline_entries', { changed_by: 1 });
    await ensureIndex(db, 'timeline_entries', { timestamp: 1 });

    // ───── AUDIT LOGS (append-only, no TTL — intentionally no auto-delete) ─────
    if (!collectionNames.includes('audit_logs')) {
      await db.createCollection('audit_logs');
    }
    await ensureIndex(db, 'audit_logs', { actor: 1 });
    await ensureIndex(db, 'audit_logs', { action: 1 });
    await ensureIndex(db, 'audit_logs', { target_type: 1, target_id: 1 });
    await ensureIndex(db, 'audit_logs', { timestamp: 1 });
    // Remove any existing TTL index on audit_logs — this must be append-only
    try {
      const indexes = await db.collection('audit_logs').listIndexes().toArray();
      for (const idx of indexes) {
        if (idx.expireAfterSeconds !== undefined) {
          await db.collection('audit_logs').dropIndex(idx.name);
          console.log('  Removed TTL index from audit_logs (append-only requirement)');
        }
      }
    } catch (e) {
      // Ignore — collection might not have indexes yet
    }

    // ───── DEPARTMENTS (reference) ─────
    if (!collectionNames.includes('departments')) {
      await db.createCollection('departments');
    }
    await ensureIndex(db, 'departments', { code: 1 }, { unique: true });

    // ───── CHARGES (reference) ─────
    if (!collectionNames.includes('charges')) {
      await db.createCollection('charges');
    }
    await ensureIndex(db, 'charges', { code: 1 }, { unique: true });
    await ensureIndex(db, 'charges', { category: 1 });

    // ───── SESSIONS ─────
    if (!collectionNames.includes('sessions')) {
      await db.createCollection('sessions');
    }
    await ensureIndex(db, 'sessions', { user_id: 1 });
    await ensureIndex(db, 'sessions', { token: 1 }, { unique: true });
    await ensureIndex(db, 'sessions', { expires_at: 1 }, { expireAfterSeconds: 0 });

    // Counter documents are one per IP/window, not one per request. Retain the
    // old collection for a safe, non-destructive deployment migration.
    if (!collectionNames.includes('rate_limit_windows')) {
      await db.createCollection('rate_limit_windows');
    }
    await ensureIndex(db, 'rate_limit_windows', { expires_at: 1 }, { expireAfterSeconds: 0 });

    console.log('Database collections and indexes initialized');
    return db;
  } catch (mongoError) {
    if (process.env.NODE_ENV === 'production') {
      throw mongoError;
    }

    console.warn('MongoDB connection failed:', mongoError.message);
    console.log('Using in-memory database for development...\n');

    // Fallback to in-memory database
    const MemoryDB = require('./memoryDb');
    db = MemoryDB;

    // Initialize collections
    const memoryCollections = [
      'users', 'filings', 'filing_sequences', 'attachments', 'prosecution_records',
      'generated_documents', 'timeline_entries', 'audit_logs', 'app_sessions',
      'departments', 'charges', 'sessions', 'rate_limit', 'rate_limit_windows'
    ];

    for (const col of memoryCollections) {
      try {
        await db.createCollection(col);
      } catch (e) {
        // Ignore if already exists
      }
    }

    console.log('In-memory database initialized');
    console.log('Note: Data will be lost when the server restarts\n');

    return db;
  }
}

/**
 * Safely create an index (ignore errors if index already exists with same spec)
 */
async function ensureIndex(database, collectionName, keys, options = {}) {
  try {
    await database.collection(collectionName).createIndex(keys, options);
  } catch (e) {
    // Index might already exist with different options — log but don't fail
    if (e.code !== 85 && e.code !== 86) {
      console.warn(`  Index warning on ${collectionName}:`, e.message);
    }
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

/**
 * Get the raw MongoClient instance
 */
function getClient() {
  return client;
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getClient,
  closeDatabase,
  ObjectId
};
