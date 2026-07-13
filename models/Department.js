// Department Model — Managed reference collection
// Future-proofing for multiple agencies beyond LSPD and DOJ

const { ObjectId } = require('mongodb');

let db = null;

const Department = {
  setDB(database) {
    db = database;
  },

  /**
   * Create a new department
   */
  async create(deptData) {
    if (!db) throw new Error('Database not connected');

    const { code, name } = deptData;
    if (!code || !name) throw new Error('Department code and name are required');

    const existing = await db.collection('departments').findOne({ code: code.toUpperCase() });
    if (existing) throw new Error('Department code already exists');

    const newDept = {
      code: code.toUpperCase(),
      name,
      created_at: new Date()
    };

    const result = await db.collection('departments').insertOne(newDept);
    return { _id: result.insertedId, ...newDept };
  },

  /**
   * Find all departments
   */
  async findAll() {
    if (!db) throw new Error('Database not connected');
    return await db.collection('departments')
      .find()
      .sort({ code: 1 })
      .toArray();
  },

  /**
   * Find department by code
   */
  async findByCode(code) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('departments').findOne({ code: code.toUpperCase() });
  },

  /**
   * Seed default departments
   */
  async seedDefaults() {
    if (!db) throw new Error('Database not connected');

    const defaults = [
      { code: 'LSPD', name: 'Los Santos Police Department' },
      { code: 'DA', name: 'District Attorney' }
    ];

    for (const dept of defaults) {
      const existing = await db.collection('departments').findOne({ code: dept.code });
      if (!existing) {
        await db.collection('departments').insertOne({
          ...dept,
          created_at: new Date()
        });
      }
    }
  }
};

module.exports = Department;
