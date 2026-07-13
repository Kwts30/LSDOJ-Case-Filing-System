const { ObjectId } = require('mongodb');

let db = null;

const GeneratedDocument = {
  setDB(database) {
    db = database;
  },

  async create(docData) {
    if (!db) throw new Error('Database not connected');

    const {
      filing_number,
      docx_base64,
      pdf_base64,
      pages, // Array of { page_number, png_base64 }
      page_count,
      conversion_status = 'unavailable',
      conversion_error = null
    } = docData;

    if (!filing_number || !docx_base64) {
      throw new Error('Filing number and DOCX content are required');
    }

    const latest = await db.collection('generated_documents')
      .find({ filing_number })
      .sort({ version: -1 })
      .limit(1)
      .toArray();

    const version = latest.length > 0 ? latest[0].version + 1 : 1;

    const newDoc = {
      filing_number,
      docx_base64,
      pdf_base64: pdf_base64 || null,
      pages: pages || [],
      page_count: page_count || (pages ? pages.length : 0),
      conversion_status,
      conversion_error,
      version,
      generated_at: new Date(),
      sent_to_judiciary_at: null
    };

    const result = await db.collection('generated_documents').insertOne(newDoc);
    // Don't return full base64 strings in the result object to save memory
    return { _id: result.insertedId, filing_number: newDoc.filing_number, version: newDoc.version, generated_at: newDoc.generated_at };
  },

  async updateDocument(docId, docData) {
    if (!db) throw new Error('Database not connected');
    const { docx_base64, pdf_base64, pages, page_count, conversion_status = 'unavailable', conversion_error = null } = docData;
    const result = await db.collection('generated_documents').updateOne(
      { _id: new ObjectId(docId) },
      {
        $set: {
          docx_base64,
          pdf_base64: pdf_base64 || null,
          pages: pages || [],
          page_count: page_count || (pages ? pages.length : 0),
          conversion_status,
          conversion_error,
          generated_at: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  },

  async findByFilingNumber(filing_number) {
    if (!db) throw new Error('Database not connected');
    // Return without base64 heavy fields by default for listing
    return await db.collection('generated_documents')
      .find({ filing_number }, { projection: { docx_base64: 0, pdf_base64: 0, pages: 0 } })
      .sort({ generated_at: -1 })
      .toArray();
  },

  async getDocumentFile(id, field) {
    if (!db) throw new Error('Database not connected');
    // field can be 'docx_base64', 'pdf_base64', or 'pages'
    const doc = await db.collection('generated_documents').findOne(
      { _id: new ObjectId(id) },
      { projection: { [field]: 1 } }
    );
    return doc ? doc[field] : null;
  },
  
  async getLatestDocumentFileByFiling(filing_number, field) {
    if (!db) throw new Error('Database not connected');
    const doc = await db.collection('generated_documents')
      .find({ filing_number }, { projection: { [field]: 1 } })
      .sort({ version: -1 })
      .limit(1)
      .toArray();
    return doc.length > 0 ? doc[0][field] : null;
  },

  async findById(docId) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('generated_documents').findOne(
      { _id: new ObjectId(docId) },
      { projection: { docx_base64: 0, pdf_base64: 0, pages: 0 } }
    );
  },

  async countByFilingNumber(filing_number) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('generated_documents').countDocuments({ filing_number });
  }
};

module.exports = GeneratedDocument;
