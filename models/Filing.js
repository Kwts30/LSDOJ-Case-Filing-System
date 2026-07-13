const { ObjectId } = require('mongodb');
const { getFilingSchema } = require('../config/filingSchemas');

let db = null;

const Filing = {
  setDB(database) {
    db = database;
  },

  async create(filingData) {
    if (!db) throw new Error('Database not connected');

    const {
      filing_type,
      accused_name,
      accused_id_number = null,
      charges = [],
      narrative = '',
      submitted_by
    } = filingData;

    if (!submitted_by) {
      throw new Error('Submitting officer is required');
    }
    
    if (!accused_name) {
      throw new Error('Accused name is required');
    }

    if (!getFilingSchema(filing_type)) {
      throw new Error('Invalid filing type');
    }

    // Generate filing number: YYYY-MMDD-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `${year}-${month}${day}`;
    const filingBase = {
      filing_type,
      status: 'draft',
      accused_name,
      accused_id_number,
      charges,
      narrative,
      submitted_by: new ObjectId(submitted_by),
      da_reviewer: null,
      revision_note: null,
      revision_reason: null,
      attested_at: null,
      attested_by_reentry: false,
      created_at: now,
      updated_at: now
    };

    const maxAttempts = parseInt(process.env.FILING_SEQUENCE_RETRY_LIMIT || '100', 10);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const seq = await this._getNextSequence(year, month, day);
      const filing_number = `${prefix}-${String(seq).padStart(4, '0')}`;
      const newFiling = { ...filingBase, filing_number };
      try {
        const result = await db.collection('filings').insertOne(newFiling);
        return { _id: result.insertedId, ...newFiling };
      } catch (error) {
        const isFilingNumberCollision = error?.code === 11000 && (error.keyPattern?.filing_number || /filing_number/i.test(error.message));
        if (!isFilingNumberCollision) throw error;
      }
    }

    throw new Error('Could not allocate a unique filing number; retry the filing creation');
  },

  async _getNextSequence(year, month, day) {
    if (!db) throw new Error('Database not connected');
    const prefix = `${year}-${month}${day}`;
    const counter = await db.collection('filing_sequences').findOneAndUpdate(
      { _id: prefix },
      { $inc: { sequence: 1 }, $set: { updated_at: new Date() } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: false }
    );
    return counter.sequence;
  },

  async findByFilingNumber(filing_number) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('filings').findOne({ filing_number });
  },

  async findById(id) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('filings').findOne({ _id: new ObjectId(id) });
  },

  async findByOfficer(officerUserId, status = null) {
    if (!db) throw new Error('Database not connected');
    const filter = { submitted_by: new ObjectId(officerUserId) };
    if (status) filter.status = status;
    return await db.collection('filings')
      .find(filter)
      .sort({ updated_at: -1 })
      .toArray();
  },

  async findByStatus(status) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('filings')
      .find({ status })
      .sort({ created_at: 1 })
      .toArray();
  },

  async findByReviewer(reviewerUserId, status = null) {
    if (!db) throw new Error('Database not connected');
    const filter = { da_reviewer: new ObjectId(reviewerUserId) };
    if (status) filter.status = status;
    return await db.collection('filings')
      .find(filter)
      .sort({ updated_at: -1 })
      .toArray();
  },

  async updateDraft(id, updateData) {
    if (!db) throw new Error('Database not connected');

    const allowedFields = ['accused_name', 'accused_id_number', 'charges', 'narrative', 'filing_type'];
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

    const result = await db.collection('filings').updateOne(
      { _id: new ObjectId(id), status: { $in: ['draft', 'needs_revision'] } },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  },

  async submit(id, attestation) {
    if (!db) throw new Error('Database not connected');

    const result = await db.collection('filings').updateOne(
      { _id: new ObjectId(id), status: { $in: ['draft', 'needs_revision'] } },
      {
        $set: {
          status: 'submitted',
          attested_at: new Date(),
          attested_by_reentry: !!attestation.password_verified,
          attested_by: attestation.attested_by ? new ObjectId(attestation.attested_by) : null,
          revision_note: null,
          revision_reason: null,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  },

  async claimForReview(id, reviewerUserId) {
    if (!db) throw new Error('Database not connected');

    const result = await db.collection('filings').updateOne(
      { _id: new ObjectId(id), status: 'submitted' },
      {
        $set: {
          status: 'under_review',
          da_reviewer: new ObjectId(reviewerUserId),
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  },

  async approve(id) {
    if (!db) throw new Error('Database not connected');

    const result = await db.collection('filings').updateOne(
      { _id: new ObjectId(id), status: 'under_review' },
      {
        $set: {
          status: 'filed',
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  },

  async dismiss(id) {
    if (!db) throw new Error('Database not connected');

    const result = await db.collection('filings').updateOne(
      { _id: new ObjectId(id), status: 'under_review' },
      {
        $set: {
          status: 'dismissed',
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  },

  async requestRevision(id, revision_reason, revision_note) {
    if (!db) throw new Error('Database not connected');
    if (!revision_reason) throw new Error('Revision reason is required');

    const result = await db.collection('filings').updateOne(
      { _id: new ObjectId(id), status: 'under_review' },
      {
        $set: {
          status: 'needs_revision',
          revision_reason,
          revision_note: revision_note || '',
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  },

  async search(filters = {}) {
    if (!db) throw new Error('Database not connected');

    const query = {};

    if (filters.accused_name) {
      query.accused_name = { $regex: filters.accused_name, $options: 'i' };
    }
    if (filters.filing_number) {
      query.filing_number = { $regex: filters.filing_number, $options: 'i' };
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.charges && filters.charges.length > 0) {
      query.charges = { $in: filters.charges };
    }
    if (filters.submitted_by) {
      query.submitted_by = new ObjectId(filters.submitted_by);
    }
    if (filters.date_from || filters.date_to) {
      query.created_at = {};
      if (filters.date_from) query.created_at.$gte = new Date(filters.date_from);
      if (filters.date_to) query.created_at.$lte = new Date(filters.date_to);
    }

    return await db.collection('filings')
      .find(query)
      .sort({ updated_at: -1 })
      .toArray();
  },

  async countByStatus() {
    if (!db) throw new Error('Database not connected');
    return await db.collection('filings').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
  },

  async getTotalCount(filter = {}) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('filings').countDocuments(filter);
  }
};

module.exports = Filing;
