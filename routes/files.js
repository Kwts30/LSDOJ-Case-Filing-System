const express = require('express');
const path = require('path');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');
const { getActor, canViewFiling } = require('../utils/accessControl');
const { resolveAttachmentPath, streamFileFromGridFS } = require('../utils/fileStorage');
const { logActivity } = require('../middleware/auth');

router.get('/attachments/:attachmentId', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.attachmentId)) {
      return res.status(404).render('error', { message: 'Attachment not found' });
    }
    const db = getDatabase();
    const attachment = await db.collection('attachments').findOne({ _id: new ObjectId(req.params.attachmentId) });
    if (!attachment) return res.status(404).render('error', { message: 'Attachment not found' });

    const filing = await db.collection('filings').findOne({ filing_number: attachment.filing_number });
    if (!canViewFiling(getActor(req), filing)) {
      return res.status(403).render('error', { message: 'You do not have access to this attachment' });
    }

    await logActivity(
      new ObjectId(getActor(req).id),
      'download',
      `Accessed attachment ${attachment._id} from filing ${filing.filing_number}`,
      'document',
      attachment._id.toString(),
      req
    );

    const filename = path.basename(attachment.original_name || 'attachment').replace(/["\\r\\n]/g, '_');
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    // Case attachments are sensitive. Do not let browsers or intermediary
    // caches retain an authorized response after the user signs out.
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.type(attachment.mime_type || path.extname(filename) || 'application/octet-stream');

    // Serve from GridFS (new uploads) or local disk (legacy records)
    if (attachment.gridfs_id) {
      return streamFileFromGridFS(db, attachment.gridfs_id, res);
    }

    const filePath = resolveAttachmentPath(attachment);
    if (!filePath) return res.status(404).render('error', { message: 'Attachment file not found' });
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Attachment delivery error:', error);
    return res.status(500).render('error', { message: 'Failed to retrieve attachment' });
  }
});

module.exports = router;
