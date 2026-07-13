const { ObjectId } = require('mongodb');

let db = null;

const Attachment = {
  setDB(database) {
    db = database;
  },

  async create(attachmentData) {
    if (!db) throw new Error('Database not connected');

    const {
      category,
      image_url = null,
      external_link = null,
      storage_key = null,
      mime_type = null,
      original_name,
      filing_number,
      uploaded_by
    } = attachmentData;

    if (!category || !filing_number || !uploaded_by) {
      throw new Error('Category, filing number, and uploader are required');
    }

    const uploadedById = typeof uploaded_by === 'string' || typeof uploaded_by === 'object' && uploaded_by._id ? uploaded_by : new ObjectId(uploaded_by);

    const newAttachment = {
      category,
      image_url,
      external_link,
      storage_key,
      mime_type,
      file_url: null,
      original_name: original_name || 'unnamed',
      filing_number,
      uploaded_by: uploadedById,
      created_at: new Date()
    };

    const result = await db.collection('attachments').insertOne(newAttachment);
    const file_url = storage_key ? `/files/attachments/${result.insertedId}` : null;
    if (file_url) {
      await db.collection('attachments').updateOne(
        { _id: result.insertedId },
        { $set: { file_url } }
      );
    }
    return { _id: result.insertedId, ...newAttachment, file_url };
  },

  async findByFilingNumber(filing_number) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('attachments')
      .find({ filing_number })
      .sort({ created_at: -1 })
      .toArray();
  },

  async findById(attachmentId) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('attachments').findOne({
      _id: new ObjectId(attachmentId)
    });
  },

  async deleteById(attachmentId) {
    if (!db) throw new Error('Database not connected');
    const result = await db.collection('attachments').deleteOne({
      _id: new ObjectId(attachmentId)
    });
    return result.deletedCount > 0;
  },

  async countByFilingNumber(filing_number) {
    if (!db) throw new Error('Database not connected');
    return await db.collection('attachments').countDocuments({ filing_number });
  },

  async verifyExists(attachmentId) {
    if (!db) throw new Error('Database not connected');
    const attachment = await this.findById(attachmentId);
    return attachment !== null;
  }
};

module.exports = Attachment;
