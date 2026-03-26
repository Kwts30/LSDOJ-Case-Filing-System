const { ObjectId } = require('mongodb');

let db = null;

const Document = {
  setDB(database) {
    db = database;
  },

  async create(docData) {
    if (!db) throw new Error('Database not connected');

    const {
      documentType,
      issuerName,
      clientName,
      userId,
      formData,
      ipAddress,
      userAgent
    } = docData;

    const newDoc = {
      documentType,
      issuerName,
      clientName,
      userId: new ObjectId(userId),
      formData,
      fileSize: 0, // Will be updated after generation
      ipAddress,
      userAgent,
      downloadedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('generated_documents').insertOne(newDoc);
    return { _id: result.insertedId, ...newDoc };
  },

  async findAll(filter = {}) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('generated_documents')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findById(docId) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('generated_documents').findOne({
      _id: new ObjectId(docId)
    });
  },

  async findByUserId(userId) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('generated_documents')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async countByType(startDate = null, endDate = null) {
    if (!db) throw new Error('Database not connected');

    const pipeline = [
      {
        $group: {
          _id: '$documentType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    if (startDate || endDate) {
      const matchStage = {};
      if (startDate) matchStage.$gte = new Date(startDate);
      if (endDate) matchStage.$lte = new Date(endDate);
      pipeline.unshift({ $match: { createdAt: matchStage } });
    }

    return await db.collection('generated_documents').aggregate(pipeline).toArray();
  },

  async countByUser(startDate = null, endDate = null) {
    if (!db) throw new Error('Database not connected');

    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $group: {
          _id: '$userId',
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
      pipeline.unshift({ $match: { createdAt: matchStage } });
    }

    return await db.collection('generated_documents').aggregate(pipeline).toArray();
  },

  async countByDateRange(startDate, endDate) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('generated_documents').aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
  },

  async getTotalCount() {
    if (!db) throw new Error('Database not connected');
    return await db.collection('generated_documents').countDocuments();
  },

  async markAsDownloaded(docId) {
    if (!db) throw new Error('Database not connected');
    await db.collection('generated_documents').updateOne(
      { _id: new ObjectId(docId) },
      {
        $set: { downloadedAt: new Date() },
        $currentDate: { updatedAt: true }
      }
    );
  }
};

module.exports = Document;
