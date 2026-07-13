// Charge Model — Managed reference collection for criminal charges
// Validates case charges against known charge codes

const { ObjectId } = require('mongodb');

let db = null;

const Charge = {
  setDB(database) {
    db = database;
  },

  /**
   * Create a new charge code
   */
  async create(chargeData) {
    if (!db) throw new Error('Database not connected');

    const { code, label, category } = chargeData;
    if (!code || !label || !category) {
      throw new Error('Charge code, label, and category are required');
    }

    const existing = await db.collection('charges').findOne({ code: code.toUpperCase() });
    if (existing) throw new Error('Charge code already exists');

    const newCharge = {
      code: code.toUpperCase(),
      label,
      category, // felony, misdemeanor, infraction
      created_at: new Date()
    };

    const result = await db.collection('charges').insertOne(newCharge);
    return { _id: result.insertedId, ...newCharge };
  },

  /**
   * Find all charges, optionally filtered by category
   */
  async findAll(category = null) {
    if (!db) throw new Error('Database not connected');
    const filter = category ? { category } : {};
    return await db.collection('charges')
      .find(filter)
      .sort({ code: 1 })
      .toArray();
  },

  /**
   * Find charge by code
   */
  async findByCode(code) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('charges').findOne({ code: code.toUpperCase() });
  },

  /**
   * Find multiple charges by code array
   */
  async findByCodes(codes) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('charges')
      .find({ code: { $in: codes.map(c => c.toUpperCase()) } })
      .toArray();
  },

  /**
   * Update a charge
   */
  async update(chargeId, updateData) {
    if (!db) throw new Error('Database not connected');

    const allowedFields = ['label', 'category'];
    const updates = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    const result = await db.collection('charges').updateOne(
      { _id: new ObjectId(chargeId) },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  },

  /**
   * Delete a charge code
   */
  async deleteById(chargeId) {
    if (!db) throw new Error('Database not connected');
    const result = await db.collection('charges').deleteOne({
      _id: new ObjectId(chargeId)
    });
    return result.deletedCount > 0;
  },

  /**
   * Seed default charges
   */
  async seedDefaults() {
    if (!db) throw new Error('Database not connected');

    const defaults = [
      { code: 'ASSAULT', label: 'Assault', category: 'misdemeanor' },
      { code: 'AGG-ASSAULT', label: 'Aggravated Assault', category: 'felony' },
      { code: 'ROBBERY', label: 'Robbery', category: 'felony' },
      { code: 'ARMED-ROBBERY', label: 'Armed Robbery', category: 'felony' },
      { code: 'BURGLARY', label: 'Burglary', category: 'felony' },
      { code: 'THEFT', label: 'Theft', category: 'misdemeanor' },
      { code: 'GRAND-THEFT', label: 'Grand Theft', category: 'felony' },
      { code: 'GTA', label: 'Grand Theft Auto', category: 'felony' },
      { code: 'MURDER', label: 'Murder', category: 'felony' },
      { code: 'ATT-MURDER', label: 'Attempted Murder', category: 'felony' },
      { code: 'MANSLAUGHTER', label: 'Manslaughter', category: 'felony' },
      { code: 'DRUG-POSS', label: 'Drug Possession', category: 'misdemeanor' },
      { code: 'DRUG-DIST', label: 'Drug Distribution', category: 'felony' },
      { code: 'DRUG-TRAFF', label: 'Drug Trafficking', category: 'felony' },
      { code: 'WEAPON-POSS', label: 'Weapon Possession', category: 'misdemeanor' },
      { code: 'WEAPON-ILLEGAL', label: 'Illegal Weapon Possession', category: 'felony' },
      { code: 'FRAUD', label: 'Fraud', category: 'felony' },
      { code: 'FORGERY', label: 'Forgery', category: 'felony' },
      { code: 'ARSON', label: 'Arson', category: 'felony' },
      { code: 'KIDNAPPING', label: 'Kidnapping', category: 'felony' },
      { code: 'EXTORTION', label: 'Extortion', category: 'felony' },
      { code: 'EVASION', label: 'Evading Law Enforcement', category: 'misdemeanor' },
      { code: 'RECKLESS-DRIVING', label: 'Reckless Driving', category: 'misdemeanor' },
      { code: 'DUI', label: 'Driving Under the Influence', category: 'misdemeanor' },
      { code: 'TRESPASS', label: 'Trespassing', category: 'infraction' },
      { code: 'VANDALISM', label: 'Vandalism', category: 'misdemeanor' },
      { code: 'DISTURB-PEACE', label: 'Disturbing the Peace', category: 'infraction' },
      { code: 'RESIST-ARREST', label: 'Resisting Arrest', category: 'misdemeanor' },
      { code: 'PERJURY', label: 'Perjury', category: 'felony' },
      { code: 'BRIBERY', label: 'Bribery', category: 'felony' }
    ];

    for (const charge of defaults) {
      const existing = await db.collection('charges').findOne({ code: charge.code });
      if (!existing) {
        await db.collection('charges').insertOne({
          ...charge,
          created_at: new Date()
        });
      }
    }
  }
};

module.exports = Charge;
