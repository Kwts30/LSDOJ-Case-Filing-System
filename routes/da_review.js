const express = require('express');
const router = express.Router();
const { getDatabase, ObjectId } = require('../utils/db');
const { logActivity, verifyPassword } = require('../middleware/auth');
const Filing = require('../models/Filing');
const ProsecutionRecord = require('../models/ProsecutionRecord');
const { REVISION_REASONS, REVISION_REASON_LABELS, ESCALATION_THRESHOLD_HOURS, STATUS_DISPLAY, FILING_TYPES } = require('../config/constants');
const { generateDocumentForFiling } = require('../utils/docGenEngine');
const multer = require('multer');
const { getActor, canReviewFiling } = require('../utils/accessControl');
const { storeFileInGridFS, deleteFileFromGridFS } = require('../utils/fileStorage');
const { validateUploadedFile, isImageMimeType } = require('../utils/uploadValidation');
const { UPLOAD_LIMITS } = require('../config/constants');

// Use memoryStorage so uploads go to GridFS instead of the local filesystem
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxFileSize, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, UPLOAD_LIMITS.allowedMimeTypes.includes(file.mimetype))
});

Filing.setDB(getDatabase());
ProsecutionRecord.setDB(getDatabase());

router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);

    const submittedFilings = await Filing.findByStatus('submitted');
    const myFilings = await Filing.findByReviewer(req.session.userId, 'under_review');

    const cutoff = new Date(Date.now() - ESCALATION_THRESHOLD_HOURS * 60 * 60 * 1000);
    const escalatedIds = new Set();
    submittedFilings.forEach(f => {
      if (f.updated_at < cutoff || f.created_at < cutoff) {
        escalatedIds.add(f.filing_number);
      }
    });

    const submitterIds = [...new Set([
      ...submittedFilings.map(f => f.submitted_by.toString()),
      ...myFilings.map(f => f.submitted_by.toString())
    ])];
    
    const submitters = await db.collection('users')
      .find({ _id: { $in: submitterIds.map(id => new ObjectId(id)) } })
      .toArray();
    const submitterMap = {};
    submitters.forEach(s => { submitterMap[s._id.toString()] = s; });

    const totalSubmitted = submittedFilings.length;
    const totalEscalated = escalatedIds.size;
    const totalMyReviews = myFilings.length;

    const recentFiled = await db.collection('filings')
      .find({ status: { $in: ['filed', 'dismissed'] } })
      .sort({ updated_at: -1 })
      .limit(20)
      .toArray();

    let avgTurnaround = 0;
    if (recentFiled.length > 0) {
      const totalMs = recentFiled.reduce((sum, f) => sum + (f.updated_at.getTime() - f.created_at.getTime()), 0);
      avgTurnaround = Math.round(totalMs / recentFiled.length / (1000 * 60 * 60));
    }

    res.render('da_review/queue', {
      title: 'Filing Review Queue - DA',
      currentPage: 'da_review',
      submittedFilings,
      myFilings,
      escalatedIds,
      submitterMap,
      stats: {
        totalSubmitted,
        totalEscalated,
        totalMyReviews,
        avgTurnaroundHours: avgTurnaround
      },
      STATUS_DISPLAY,
      FILING_TYPES
    });
  } catch (error) {
    console.error('Review queue error:', error);
    res.status(500).render('error', { message: 'Failed to load review queue' });
  }
});

router.get('/:filingNumber', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    
    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!filing) return res.status(404).render('error', { message: 'Filing not found' });

    const [attachments, timeline, generatedDocs, submitter, chargesDocs] = await Promise.all([
      db.collection('attachments').find({ filing_number: filing.filing_number }).sort({ created_at: -1 }).toArray(),
      db.collection('timeline_entries').find({ filing_number: filing.filing_number }).sort({ timestamp: 1 }).toArray(),
      db.collection('generated_documents').find({ filing_number: filing.filing_number }, { projection: { docx_base64: 0, pdf_base64: 0, pages: 0 } }).sort({ generated_at: -1 }).toArray(),
      db.collection('users').findOne({ _id: filing.submitted_by }),
      db.collection('charges').find({ code: { $in: filing.charges || [] } }).toArray()
    ]);

    const actorIds = [...new Set(timeline.map(t => t.changed_by.toString()))];
    const actors = await db.collection('users')
      .find({ _id: { $in: actorIds.map(id => new ObjectId(id)) } })
      .toArray();
    const actorMap = {};
    actors.forEach(a => { actorMap[a._id.toString()] = a; });

    const chargeMap = {};
    chargesDocs.forEach(c => { chargeMap[c.code] = c; });

    const isAssignedReviewer = filing.da_reviewer && filing.da_reviewer.toString() === req.session.userId;

    await logActivity(
      new ObjectId(req.session.userId), 'view',
      `Reviewed filing ${filing.filing_number}`,
      'filing', filing.filing_number, req
    );

    res.render('da_review/detail', {
      title: `Review Filing ${filing.filing_number} - DA`,
      currentPage: 'da_review',
      filing,
      attachments,
      timeline,
      generatedDocs,
      submitter,
      chargeMap,
      actorMap,
      isAssignedReviewer,
      REVISION_REASONS,
      REVISION_REASON_LABELS,
      STATUS_DISPLAY,
      FILING_TYPES
    });
  } catch (error) {
    console.error('Review detail error:', error);
    res.status(500).render('error', { message: 'Failed to load filing for review' });
  }
});

router.post('/:filingNumber/claim', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);

    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!filing || filing.status !== 'submitted') {
      return res.status(404).json({ error: 'Filing not found or already claimed' });
    }

    const claimed = await Filing.claimForReview(filing._id, req.session.userId);
    if (!claimed) {
      return res.status(409).json({ error: 'This filing was claimed by another reviewer. Refresh the queue.' });
    }

    await db.collection('timeline_entries').insertOne({
      status: 'under_review',
      note: `Claimed for review by ${req.session.name} (${req.session.position})`,
      timestamp: new Date(),
      filing_number: req.params.filingNumber,
      changed_by: new ObjectId(req.session.userId)
    });

    await logActivity(
      new ObjectId(req.session.userId), 'claim',
      `Claimed filing ${req.params.filingNumber} for review`,
      'filing', req.params.filingNumber, req
    );

    res.json({ success: true, message: 'Filing claimed for review' });
  } catch (error) {
    console.error('Filing claim error:', error);
    res.status(500).json({ error: 'Failed to claim filing' });
  }
});

router.post('/:filingNumber/approve', upload.single('da_signature_file'), async (req, res) => {
  let signatureAttachment = null;
  let generatedDocument = null;
  let uploadedGridFSId = null;
  try {
    console.log('[DA Approve] Starting approval for filing:', req.params.filingNumber);
    const db = getDatabase();
    Filing.setDB(db);
    ProsecutionRecord.setDB(db);

    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    console.log('[DA Approve] Filing found:', !!filing, 'Status:', filing?.status);
    
    const actor = getActor(req);
    if (!filing || filing.status !== 'under_review' || !canReviewFiling(actor, filing)) {
      console.log('[DA Approve] Validation failed - Filing:', !!filing, 'Status under_review:', filing?.status === 'under_review', 'User is reviewer:', filing?.da_reviewer?.toString() === req.session.userId);
      return res.status(404).json({ error: 'Filing not found or you are not the assigned reviewer' });
    }

    if (!req.file) {
      console.log('[DA Approve] No signature file provided');
      return res.status(400).json({ error: 'Signature image is required to approve filing' });
    }

    const { approval_password: approvalPassword } = req.body;
    if (!approvalPassword) {
      return res.status(400).json({ error: 'Password confirmation is required to approve a filing' });
    }
    const reviewerAccount = await db.collection('users').findOne({ _id: new ObjectId(actor.id) });
    if (!reviewerAccount || !(await verifyPassword(approvalPassword, reviewerAccount.password_hash))) {
      return res.status(401).json({ error: 'Password verification failed' });
    }
    const signatureMimeType = await validateUploadedFile(req.file, UPLOAD_LIMITS.allowedMimeTypes);
    if (!isImageMimeType(signatureMimeType)) {
      return res.status(400).json({ error: 'DA signature must be a PNG, JPG, or WEBP image' });
    }

    // Store signature in GridFS
    uploadedGridFSId = await storeFileInGridFS(db, req.file.buffer, req.file.originalname, signatureMimeType);
    console.log('[DA Approve] Saving signature attachment to GridFS:', uploadedGridFSId);
    const Attachment = require('../models/Attachment');
    Attachment.setDB(db);
    try {
      signatureAttachment = await Attachment.create({
        category: 'da_signature',
        gridfs_id: uploadedGridFSId,
        mime_type: signatureMimeType,
        original_name: req.file.originalname,
        filing_number: filing.filing_number,
        uploaded_by: req.session.userId
      });
    } catch (attachmentError) {
      console.error(`[DA Approve] Failed to save DA signature attachment:`, attachmentError);
      throw new Error('Failed to save signature file');
    }

    const submitter = await db.collection('users').findOne({ _id: filing.submitted_by });
    const reviewer = await db.collection('users').findOne({ _id: filing.da_reviewer });
    
    // Fetch updated filing to include latest signature data
    const updatedFiling = await Filing.findByFilingNumber(req.params.filingNumber);

    console.log('[DA Approve] Generating documents before final approval');
    generatedDocument = await generateDocumentForFiling(updatedFiling, submitter, reviewer);

    console.log('[DA Approve] Approving filing');
    const approved = await Filing.approve(filing._id);
    if (!approved) {
      if (generatedDocument?._id) await db.collection('generated_documents').deleteOne({ _id: generatedDocument._id });
      const stateError = new Error('The filing state changed before approval could be completed');
      stateError.status = 409;
      throw stateError;
    }

    console.log('[DA Approve] Creating prosecution record');
    await ProsecutionRecord.create({
      filing_number: filing.filing_number,
      approved_by: req.session.userId
    });

    console.log('[DA Approve] Creating timeline entry');
    await db.collection('timeline_entries').insertOne({
      status: 'filed',
      note: `Approved by ${req.session.name} (${req.session.position}). Documents generated.`,
      timestamp: new Date(),
      filing_number: req.params.filingNumber,
      changed_by: new ObjectId(req.session.userId)
    });

    await logActivity(
      new ObjectId(req.session.userId), 'approve',
      `Approved filing ${req.params.filingNumber}`,
      'filing', req.params.filingNumber, req
    );

    console.log('[DA Approve] Approval complete for filing:', req.params.filingNumber);
    res.json({ success: true, message: 'Filing approved and documents generated' });
  } catch (error) {
    // Cleanup: remove GridFS file and attachment DB record if upload partially succeeded
    if (signatureAttachment) {
      try {
        await getDatabase().collection('attachments').deleteOne({ _id: signatureAttachment._id });
        if (uploadedGridFSId) await deleteFileFromGridFS(getDatabase(), uploadedGridFSId);
      } catch (cleanupError) {
        console.error('[DA Approve] Signature cleanup error:', cleanupError);
      }
    } else if (uploadedGridFSId) {
      await deleteFileFromGridFS(getDatabase(), uploadedGridFSId).catch(() => {});
    }
    console.error('[DA Approve] Filing approval error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to approve filing' });
  }
});

router.post('/:filingNumber/revise', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    const { revision_reason, revision_note } = req.body;

    if (!revision_reason) return res.status(400).json({ error: 'Revision reason is required' });

    const validReasons = Object.values(REVISION_REASONS);
    if (!validReasons.includes(revision_reason)) return res.status(400).json({ error: 'Invalid revision reason' });

    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!filing || filing.status !== 'under_review' || filing.da_reviewer.toString() !== req.session.userId) {
      return res.status(404).json({ error: 'Filing not found or you are not the assigned reviewer' });
    }

    await Filing.requestRevision(filing._id, revision_reason, revision_note);

    const reasonLabel = REVISION_REASON_LABELS[revision_reason] || revision_reason;
    await db.collection('timeline_entries').insertOne({
      status: 'needs_revision',
      note: `Revision requested by ${req.session.name}: ${reasonLabel}. ${revision_note || ''}`.trim(),
      timestamp: new Date(),
      filing_number: req.params.filingNumber,
      changed_by: new ObjectId(req.session.userId)
    });

    await logActivity(
      new ObjectId(req.session.userId), 'revise',
      `Requested revision on filing ${req.params.filingNumber}: ${reasonLabel}`,
      'filing', req.params.filingNumber, req
    );

    res.json({ success: true, message: 'Revision requested' });
  } catch (error) {
    console.error('Filing revision error:', error);
    res.status(500).json({ error: 'Failed to request revision' });
  }
});

router.post('/:filingNumber/dismiss', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);

    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!filing || filing.status !== 'under_review' || filing.da_reviewer.toString() !== req.session.userId) {
      return res.status(404).json({ error: 'Filing not found or you are not the assigned reviewer' });
    }

    await Filing.dismiss(filing._id);

    await db.collection('timeline_entries').insertOne({
      status: 'dismissed',
      note: `Dismissed by ${req.session.name}`,
      timestamp: new Date(),
      filing_number: req.params.filingNumber,
      changed_by: new ObjectId(req.session.userId)
    });

    await logActivity(
      new ObjectId(req.session.userId), 'dismiss',
      `Dismissed filing ${req.params.filingNumber}`,
      'filing', req.params.filingNumber, req
    );

    res.json({ success: true, message: 'Filing dismissed' });
  } catch (error) {
    console.error('Filing dismiss error:', error);
    res.status(500).json({ error: 'Failed to dismiss filing' });
  }
});

module.exports = router;
