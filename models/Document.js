const { ObjectId } = require('mongodb');

let db = null;

// DOCUMENTS Model - Maps to ERD documents collection
const Document = {
  setDB(database) {
    db = database;
  },

  async create(docData) {
    if (!db) throw new Error('Database not connected');

    const {
      doc_type,
      issuer_name,
      client_name,
      user_id,
      form_data,
      ip_address,
      user_agent
    } = docData;

    const newDoc = {
      doc_type,
      issuer_name,
      client_name,
      user_id: new ObjectId(user_id),
      form_data,
      file_size: 0,
      ip_address,
      user_agent,
      downloaded_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('documents').insertOne(newDoc);
    return { _id: result.insertedId, ...newDoc };
  },

  async findAll(filter = {}) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('documents')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();
  },

  async findById(docId) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('documents').findOne({
      _id: new ObjectId(docId)
    });
  },

  async findByUserId(user_id) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('documents')
      .find({ user_id: new ObjectId(user_id) })
      .sort({ created_at: -1 })
      .toArray();
  },

  async countByType(startDate = null, endDate = null) {
    if (!db) throw new Error('Database not connected');

    const pipeline = [
      {
        $group: {
          _id: '$doc_type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    if (startDate || endDate) {
      const matchStage = {};
      if (startDate) matchStage.$gte = new Date(startDate);
      if (endDate) matchStage.$lte = new Date(endDate);
      pipeline.unshift({ $match: { created_at: matchStage } });
    }

    return await db.collection('documents').aggregate(pipeline).toArray();
  },

  async countByUser(startDate = null, endDate = null) {
    if (!db) throw new Error('Database not connected');

    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $group: {
          _id: '$user_id',
          username: { $first: { $arrayElemAt: ['$user.username', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    if (startDate || endDate) {
      const matchStage = {};
      if (startDate) matchStage.$gte = new Date(startDate);
      if (endDate) matchStage.$lte = new Date(endDate);
      pipeline.unshift({ $match: { created_at: matchStage } });
    }

    return await db.collection('documents').aggregate(pipeline).toArray();
  },

  async countByDateRange(startDate, endDate) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('documents').aggregate([
      {
        $match: {
          created_at: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
  },

  async getTotalCount() {
    if (!db) throw new Error('Database not connected');
    return await db.collection('documents').countDocuments();
  },

  async markAsDownloaded(docId) {
    if (!db) throw new Error('Database not connected');
    await db.collection('documents').updateOne(
      { _id: new ObjectId(docId) },
      {
        $set: { downloaded_at: new Date() },
        $currentDate: { updated_at: true }
      }
    );
  }
};

module.exports = Document;
