// In-memory database fallback for development
// Provides a MongoDB-like interface without requiring MongoDB installation

const { ObjectId } = require('mongodb');

let collections = {
  users: [],
  generated_documents: [],
  activity_logs: [],
  rate_limit: []
};

const MemoryDB = {
  collection(name) {
    if (!collections[name]) {
      collections[name] = [];
    }

    return {
      async insertOne(doc) {
        const newDoc = {
          _id: new ObjectId(),
          ...doc,
          createdAt: doc.createdAt || new Date()
        };
        collections[name].push(newDoc);
        return { insertedId: newDoc._id };
      },

      async findOne(query) {
        return collections[name].find(doc => matchQuery(doc, query)) || null;
      },

      async find(query = {}) {
        const results = collections[name].filter(doc => matchQuery(doc, query));

        return new QueryBuilder(results);
      },

      async updateOne(query, update) {
        const index = collections[name].findIndex(doc => matchQuery(doc, query));
        if (index !== -1) {
          const updateData = update.$set || update;
          collections[name][index] = { ...collections[name][index], ...updateData };
          return { modifiedCount: 1, matchedCount: 1 };
        }
        return { modifiedCount: 0, matchedCount: 0 };
      },

      async deleteMany(query) {
        const before = collections[name].length;
        collections[name] = collections[name].filter(doc => !matchQuery(doc, query));
        return { deletedCount: before - collections[name].length };
      },

      async countDocuments(query = {}) {
        return collections[name].filter(doc => matchQuery(doc, query)).length;
      },

      async aggregate(pipeline) {
        let results = [...collections[name]];

        for (const stage of pipeline) {
          if (stage.$match) {
            results = results.filter(doc => matchQuery(doc, stage.$match));
          } else if (stage.$group) {
            const grouped = {};
            results.forEach(doc => {
              const key = JSON.stringify(stage.$group._id);
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push(doc);
            });
            results = Object.entries(grouped).map(([key, docs]) => {
              const output = { _id: JSON.parse(key) };
              Object.keys(stage.$group).forEach(field => {
                if (field !== '_id') {
                  if (stage.$group[field].$sum === 1) {
                    output[field] = docs.length;
                  }
                }
              });
              return output;
            });
          } else if (stage.$sort) {
            const [field, direction] = Object.entries(stage.$sort)[0];
            results.sort((a, b) => direction === -1 ?
              (b[field] > a[field] ? 1 : -1) :
              (a[field] > b[field] ? 1 : -1)
            );
          }
        }

        return { toArray: async () => results };
      },

      async createIndex(spec, options = {}) {
        // No-op in memory
        return;
      }
    };
  },

  async listCollections() {
    return { toArray: async () => Object.keys(collections).map(name => ({ name })) };
  },

  async createCollection(name) {
    if (!collections[name]) {
      collections[name] = [];
    }
  },

  async dropDatabase() {
    collections = {
      users: [],
      generated_documents: [],
      activity_logs: [],
      rate_limit: []
    };
  }
};

function matchQuery(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const key in query) {
    if (key === '$or') {
      return query.$or.some(condition => matchQuery(doc, condition));
    }
    if (key === '$and') {
      return query.$and.every(condition => matchQuery(doc, condition));
    }
    if (typeof query[key] === 'object' && query[key] !== null) {
      if (query[key].$gte !== undefined && doc[key] < query[key].$gte) return false;
      if (query[key].$lte !== undefined && doc[key] > query[key].$lte) return false;
      if (query[key].$in && !query[key].$in.includes(doc[key])) return false;
    } else if (doc[key] !== query[key]) {
      return false;
    }
  }
  return true;
}

// Query builder for proper method chaining
class QueryBuilder {
  constructor(data) {
    this.data = data;
    this._skip = 0;
    this._limit = Infinity;
    this._sort = null;
  }

  sort(order) {
    const [field, direction] = Object.entries(order)[0];
    this._sort = { field, direction };
    this.data.sort((a, b) => {
      if (direction === -1) {
        return b[field] > a[field] ? 1 : -1;
      }
      return a[field] > b[field] ? 1 : -1;
    });
    return this;
  }

  skip(n) {
    this._skip = n;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  async toArray() {
    return this.data.slice(this._skip, this._skip + this._limit);
  }
}

module.exports = MemoryDB;
