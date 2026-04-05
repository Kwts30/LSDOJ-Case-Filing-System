const { ObjectId } = require('mongodb');

let db = null;

// AUDIT_LOGS Model - Maps to ERD audit_logs collection
const AuditLog = {
  setDB(database) {
    db = database;
  },

  async log(logData) {
    if (!db) throw new Error('Database not connected');

    const {
      user_id,
      action,
      document_id = null,
      details = '',
      result = 'success',
      ip_address = '',
      user_agent = ''
    } = logData;

    const newLog = {
      user_id: new ObjectId(user_id),
      action,
      document_id: document_id ? new ObjectId(document_id) : null,
      details,
      result,
      ip_address,
      user_agent,
      timestamp: new Date()
    };

    await db.collection('audit_logs').insertOne(newLog);
    return newLog;
  },

  async findAll(filter = {}) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('audit_logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray();
  },

  async findByUser(user_id) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('audit_logs')
      .find({ user_id: new ObjectId(user_id) })
      .sort({ timestamp: -1 })
      .toArray();
  },

  async findByAction(action, startDate = null, endDate = null) {
    if (!db) throw new Error('Database not connected');

    const filter = { action };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    return await db.collection('audit_logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray();
  },

  async getActivityStats(startDate = null, endDate = null) {
    if (!db) throw new Error('Database not connected');

    const pipeline = [
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    if (startDate || endDate) {
      const matchStage = {};
      if (startDate) matchStage.$gte = new Date(startDate);
      if (endDate) matchStage.$lte = new Date(endDate);
      pipeline.unshift({ $match: { timestamp: matchStage } });
    }

    return await db.collection('audit_logs').aggregate(pipeline).toArray();
  },

  async cleanup(olderThanDays = 90) {
    if (!db) throw new Error('Database not connected');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.collection('audit_logs').deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    return result.deletedCount;
  }
};

module.exports = AuditLog;
