// In-memory database fallback for development
// Provides a MongoDB-like interface without requiring MongoDB installation
// NOTE: find() returns a QueryBuilder (sync) — must NOT be async

const { ObjectId } = require('mongodb');

let collections = {
  users: [],
  documents: [],
  audit_logs: [],
  activity_logs: [],
  generated_documents: [],
  rate_limit: [],
  filing_sequences: [],
  app_sessions: []
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
          created_at: doc.created_at || new Date(),
          createdAt: doc.createdAt || new Date()
        };
        collections[name].push(newDoc);
        return { insertedId: newDoc._id };
      },

      async findOne(query) {
        return collections[name].find(doc => matchQuery(doc, query)) || null;
      },

      // IMPORTANT: find() must be SYNCHRONOUS so callers can chain .sort().limit().toArray()
      find(query = {}) {
        const results = collections[name].filter(doc => matchQuery(doc, query));
        return new QueryBuilder(results);
      },

      async updateOne(query, update, options = {}) {
        const index = collections[name].findIndex(doc => matchQuery(doc, query));
        if (index !== -1) {
          const updateData = update.$set || update;
          const increments = update.$inc || {};
          const next = { ...collections[name][index], ...updateData };
          Object.entries(increments).forEach(([field, value]) => { next[field] = (Number(next[field]) || 0) + value; });
          if (update.$currentDate) Object.keys(update.$currentDate).forEach(field => { next[field] = new Date(); });
          collections[name][index] = next;
          return { modifiedCount: 1, matchedCount: 1 };
        }
        if (options.upsert) {
          const inserted = { _id: query._id || new ObjectId(), ...(update.$set || update), created_at: new Date() };
          collections[name].push(inserted);
          return { modifiedCount: 0, matchedCount: 0, upsertedId: inserted._id };
        }
        return { modifiedCount: 0, matchedCount: 0 };
      },

      async updateMany(query, update) {
        let modifiedCount = 0;
        for (let index = 0; index < collections[name].length; index += 1) {
          if (!matchQuery(collections[name][index], query)) continue;
          const current = collections[name][index];
          const next = { ...current, ...(update.$set || {}) };
          if (update.$rename) Object.entries(update.$rename).forEach(([from, to]) => { if (Object.prototype.hasOwnProperty.call(current, from)) { next[to] = current[from]; delete next[from]; } });
          if (update.$inc) Object.entries(update.$inc).forEach(([field, value]) => { next[field] = (Number(next[field]) || 0) + value; });
          if (update.$currentDate) Object.keys(update.$currentDate).forEach(field => { next[field] = new Date(); });
          collections[name][index] = next;
          modifiedCount += 1;
        }
        return { modifiedCount, matchedCount: modifiedCount };
      },

      async findOneAndUpdate(query, update, options = {}) {
        const index = collections[name].findIndex(doc => matchQuery(doc, query));
        let next;
        if (index !== -1) {
          next = { ...collections[name][index], ...(update.$set || {}) };
          Object.entries(update.$inc || {}).forEach(([field, value]) => { next[field] = (Number(next[field]) || 0) + value; });
          collections[name][index] = next;
        } else if (options.upsert) {
          next = { ...query, ...(update.$set || {}), created_at: new Date() };
          Object.entries(update.$inc || {}).forEach(([field, value]) => { next[field] = (Number(next[field]) || 0) + value; });
          collections[name].push(next);
        } else {
          return null;
        }
        return next;
      },

      async deleteOne(query) {
        const index = collections[name].findIndex(doc => matchQuery(doc, query));
        if (index !== -1) {
          collections[name].splice(index, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },

      async deleteMany(query) {
        const before = collections[name].length;
        collections[name] = collections[name].filter(doc => !matchQuery(doc, query));
        return { deletedCount: before - collections[name].length };
      },

      async countDocuments(query = {}) {
        return collections[name].filter(doc => matchQuery(doc, query)).length;
      },

      aggregate(pipeline) {
        let results = [...collections[name]];

        for (const stage of pipeline) {
          if (stage.$match) {
            results = results.filter(doc => matchQuery(doc, stage.$match));
          } else if (stage.$group) {
            const grouped = {};
            const groupIdExpr = stage.$group._id;

            results.forEach(doc => {
              // Support string field reference like '$doc_type' or null
              let key;
              if (typeof groupIdExpr === 'string' && groupIdExpr.startsWith('$')) {
                const field = groupIdExpr.slice(1);
                key = doc[field] !== undefined ? String(doc[field]) : '__null__';
              } else if (groupIdExpr === null) {
                key = '__all__';
              } else {
                key = JSON.stringify(groupIdExpr);
              }

              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(doc);
            });

            results = Object.entries(grouped).map(([key, docs]) => {
              const output = {};
              // Resolve _id
              if (typeof groupIdExpr === 'string' && groupIdExpr.startsWith('$')) {
                output._id = key === '__null__' ? null : key;
              } else if (groupIdExpr === null) {
                output._id = null;
              } else {
                output._id = JSON.parse(key);
              }

              Object.keys(stage.$group).forEach(field => {
                if (field === '_id') return;
                const op = stage.$group[field];
                if (op.$sum !== undefined) {
                  if (op.$sum === 1) {
                    output[field] = docs.length;
                  } else if (typeof op.$sum === 'string' && op.$sum.startsWith('$')) {
                    const sumField = op.$sum.slice(1);
                    output[field] = docs.reduce((acc, d) => acc + (Number(d[sumField]) || 0), 0);
                  } else {
                    output[field] = docs.length * (Number(op.$sum) || 0);
                  }
                } else if (op.$first !== undefined) {
                  const firstField = typeof op.$first === 'string' && op.$first.startsWith('$')
                    ? op.$first.slice(1) : null;
                  output[field] = firstField ? docs[0]?.[firstField] : op.$first;
                } else if (op.$last !== undefined) {
                  const lastField = typeof op.$last === 'string' && op.$last.startsWith('$')
                    ? op.$last.slice(1) : null;
                  output[field] = lastField ? docs[docs.length - 1]?.[lastField] : op.$last;
                }
              });
              return output;
            });
          } else if (stage.$sort) {
            const entries = Object.entries(stage.$sort);
            results.sort((a, b) => {
              for (const [field, dir] of entries) {
                const av = a[field], bv = b[field];
                if (av === bv) continue;
                return dir === -1 ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
              }
              return 0;
            });
          } else if (stage.$limit) {
            results = results.slice(0, stage.$limit);
          } else if (stage.$skip) {
            results = results.slice(stage.$skip);
          }
        }

        return { toArray: async () => results };
      },

      async createIndex(spec, options = {}) {
        // No-op in memory
        return 'index_created';
      },

      async dropIndex(name) {
        return;
      },

      async listIndexes() {
        return { toArray: async () => [] };
      }
    };
  },

  listCollections() {
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
      documents: [],
      audit_logs: [],
      activity_logs: [],
      generated_documents: [],
      rate_limit: [],
      filing_sequences: [],
      app_sessions: []
    };
  },

  // Expose raw collections for debugging
  _collections: () => collections
};

function matchQuery(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const key in query) {
    if (key === '$or') {
      if (!query.$or.some(condition => matchQuery(doc, condition))) return false;
      continue;
    }
    if (key === '$and') {
      if (!query.$and.every(condition => matchQuery(doc, condition))) return false;
      continue;
    }
    if (key === '$nor') {
      if (query.$nor.some(condition => matchQuery(doc, condition))) return false;
      continue;
    }

    const queryVal = query[key];
    const docVal = doc[key];

    if (queryVal !== null && typeof queryVal === 'object' && !Array.isArray(queryVal)) {
      // Handle ObjectId comparison
      if (queryVal._bsontype === 'ObjectId' || queryVal instanceof ObjectId) {
        if (String(docVal) !== String(queryVal)) return false;
        continue;
      }
      // Comparison operators
      if (queryVal.$gte !== undefined && !(docVal >= queryVal.$gte)) return false;
      if (queryVal.$gt  !== undefined && !(docVal >  queryVal.$gt))  return false;
      if (queryVal.$lte !== undefined && !(docVal <= queryVal.$lte)) return false;
      if (queryVal.$lt  !== undefined && !(docVal <  queryVal.$lt))  return false;
      if (queryVal.$ne  !== undefined && docVal === queryVal.$ne)     return false;
      if (queryVal.$in  !== undefined && !queryVal.$in.some(v => String(v) === String(docVal))) return false;
      if (queryVal.$nin !== undefined && queryVal.$nin.some(v => String(v) === String(docVal))) return false;
      if (queryVal.$exists !== undefined) {
        const fieldExists = docVal !== undefined;
        if (queryVal.$exists !== fieldExists) return false;
      }
    } else {
      // Direct comparison (handle ObjectId vs string)
      if (queryVal !== null && typeof queryVal === 'object' && queryVal._bsontype) {
        if (String(docVal) !== String(queryVal)) return false;
      } else if (String(docVal) !== String(queryVal) && docVal !== queryVal) {
        return false;
      }
    }
  }
  return true;
}

// Query builder for proper synchronous method chaining
class QueryBuilder {
  constructor(data) {
    this.data = [...data];
    this._skip = 0;
    this._limit = Infinity;
  }

  sort(order) {
    const entries = Object.entries(order);
    this.data.sort((a, b) => {
      for (const [field, dir] of entries) {
        const av = a[field], bv = b[field];
        if (av === bv) continue;
        return dir === -1 ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
      }
      return 0;
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
