const { ObjectId } = require('mongodb');

let db = null;

const ProsecutionRecord = {
  setDB(database) {
    db = database;
  },

  async create(recordData) {
    if (!db) throw new Error('Database not connected');

    const { filing_number, approved_by } = recordData;

    if (!filing_number || !approved_by) {
      throw new Error('Filing number and approver are required');
    }

    const newRecord = {
      filing_number,
      approved_by: new ObjectId(approved_by),
      approved_at: new Date()
    };

    const result = await db.collection('prosecution_records').insertOne(newRecord);
    return { _id: result.insertedId, ...newRecord };
  },

  async findByFilingNumber(filing_number) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('prosecution_records').findOne({ filing_number });
  }
};

module.exports = ProsecutionRecord;
