const { ObjectId } = require('mongodb');

let db = null;

const ActivityLog = {
  setDB(database) {
    db = database;
  },

  async log(logData) {
    if (!db) throw new Error('Database not connected');

    const {
      userId,
      action,
      resourceId = null,
      details = '',
      result = 'success',
      ipAddress = '',
      userAgent = ''
    } = logData;

    const newLog = {
      userId: new ObjectId(userId),
      action,
      resourceId: resourceId ? new ObjectId(resourceId) : null,
      details,
      result,
      ipAddress,
      userAgent,
      timestamp: new Date()
    };

    await db.collection('activity_logs').insertOne(newLog);
    return newLog;
  },

  async findAll(filter = {}) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('activity_logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray();
  },

  async findByUser(userId) {
    if (!db) throw new Error('Database not connected');

    return await db.collection('activity_logs')
      .find({ userId: new ObjectId(userId) })
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

    return await db.collection('activity_logs')
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

    return await db.collection('activity_logs').aggregate(pipeline).toArray();
  },

  async cleanup(olderThanDays = 90) {
    if (!db) throw new Error('Database not connected');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.collection('activity_logs').deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    return result.deletedCount;
  }
};

module.exports = ActivityLog;
