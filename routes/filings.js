const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDatabase, ObjectId } = require('../utils/db');
const { logActivity, verifyPassword } = require('../middleware/auth');
const Filing = require('../models/Filing');
const Attachment = require('../models/Attachment');
const { FILING_STATUSES, REVISION_REASON_LABELS, ATTACHMENT_TYPES, UPLOAD_LIMITS, DEPARTMENTS, POSITIONS, FILING_TYPES } = require('../config/constants');
const { getFilingSchema, getFilingTypesForDepartment } = require('../config/filingSchemas');
const { normalizeFilingInput, validateFilingInput, getUploadCategories } = require('../utils/filingValidation');
const { getActor, canViewFiling, canEditFiling, canCreateFiling } = require('../utils/accessControl');
const { resolveAttachmentPath, removeStoredFile, storeFileInGridFS, deleteFileFromGridFS } = require('../utils/fileStorage');
const { validateUploadedFile, isImageMimeType } = require('../utils/uploadValidation');

// Use memoryStorage so uploads go to GridFS instead of the local filesystem
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxFileSize, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, UPLOAD_LIMITS.allowedMimeTypes.includes(file.mimetype))
});

function getRequestFiles(req) {
  return Array.isArray(req.files) ? req.files : [];
}

// GridFS cleanup — only called when attachment creation fails after upload.
// Files in-memory (buffer) need no cleanup; GridFS files are deleted if stored.
async function cleanupGridFSFiles(db, gridfsIds) {
  await Promise.all(gridfsIds.map(id => deleteFileFromGridFS(db, id).catch(() => {})));
}

function getCategories(req, fileCount) {
  return getUploadCategories(req.body.categories || req.body.category, fileCount);
}

async function getChargeCodes(db) {
  const charges = await db.collection('charges').find({}, { projection: { code: 1 } }).toArray();
  return charges.map(charge => charge.code);
}

async function validateDraftInput(db, input, department) {
  const result = validateFilingInput(input, {
    department,
    chargeCodes: await getChargeCodes(db),
    requireComplete: false
  });
  if (!result.valid) throw new Error(result.errors.join('. '));
  return result.schema;
}

async function createAttachments({ db, filing, files, categories, uploadedBy }) {
  if (files.length === 0) return [];

  const schema = getFilingSchema(filing.filing_type);
  if (!schema) throw new Error('Unsupported filing type');

  const currentCount = await Attachment.countByFilingNumber(filing.filing_number);
  if (currentCount + files.length > UPLOAD_LIMITS.maxFilesPerCase) {
    throw new Error(`Maximum ${UPLOAD_LIMITS.maxFilesPerCase} attachments per filing allowed`);
  }

  const mimeTypes = await Promise.all(files.map(file => validateUploadedFile(file, UPLOAD_LIMITS.allowedMimeTypes)));
  const created = [];
  const storedGridFSIds = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const category = categories[index];
      const mimeType = mimeTypes[index];
      const isSignature = category === 'officer_signature' || category === 'da_signature';

      if (!schema.requirements.evidence && !isSignature) {
        throw new Error('This filing type does not accept evidence attachments');
      }
      if (isSignature && !isImageMimeType(mimeType)) {
        throw new Error('Signature files must be PNG, JPG, or WEBP images');
      }
      if (isSignature) {
        const existing = await db.collection('attachments').findOne({ filing_number: filing.filing_number, category });
        if (existing) throw new Error(`A ${category.replace('_', ' ')} already exists for this filing`);
      }

      // Store to GridFS (memory buffer → MongoDB)
      const gridfsId = await storeFileInGridFS(db, file.buffer, file.originalname, mimeType);
      storedGridFSIds.push(gridfsId);

      const attachment = await Attachment.create({
        category,
        gridfs_id: gridfsId,
        mime_type: mimeType,
        original_name: file.originalname,
        filing_number: filing.filing_number,
        uploaded_by: uploadedBy
      });
      created.push(attachment);
    }
    return created;
  } catch (error) {
    // Rollback: delete GridFS files and DB records
    await cleanupGridFSFiles(db, storedGridFSIds);
    await Promise.all(created.map(attachment => Attachment.deleteById(attachment._id)));
    throw error;
  }
}

function renderAccessDenied(res) {
  return res.status(403).render('error', { message: 'You do not have access to this filing' });
}


router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    const actor = getActor(req);
    const statusFilter = Object.values(FILING_STATUSES).includes(req.query.status) ? req.query.status : null;
    const canReviewAll = actor.department === 'DA' || actor.adminRole === 'super_admin';
    const filings = canReviewAll
      ? await db.collection('filings').find(statusFilter ? { status: statusFilter } : {}).sort({ updated_at: -1 }).toArray()
      : await Filing.findByOfficer(actor.id, statusFilter);

    const stats = { total: filings.length, draft: 0, submitted: 0, under_review: 0, needs_revision: 0, filed: 0, dismissed: 0 };
    filings.forEach(filing => { if (Object.hasOwn(stats, filing.status)) stats[filing.status] += 1; });

    res.render('filings/list', {
      title: canReviewAll ? 'All Filings - LSPD DA Filing System' : 'My Filings - LSPD DA Filing System',
      currentPage: 'filings',
      filings,
      stats,
      statusFilter,
      FILING_STATUSES,
      FILING_TYPES
    });
  } catch (error) {
    console.error('Filing list error:', error);
    res.status(500).render('error', { message: 'Failed to load filings' });
  }
});

router.get('/new', async (req, res) => {
  try {
    const actor = getActor(req);
    const filingTypes = getFilingTypesForDepartment(actor.department);
    if (filingTypes.length === 0) return renderAccessDenied(res);

    const db = getDatabase();
    const charges = await db.collection('charges').find().sort({ code: 1 }).toArray();
    res.render('filings/form', {
      title: 'File New Case - LSPD DA Filing System',
      currentPage: 'filings-new',
      editFiling: null,
      charges,
      ATTACHMENT_TYPES,
      FILING_TYPES: filingTypes,
      FILING_SCHEMAS: JSON.stringify(getFilingTypesForDepartment(actor.department).reduce((schemas, type) => {
        schemas[type.value] = getFilingSchema(type.value);
        return schemas;
      }, {})),
      DEPARTMENTS,
      POSITIONS
    });
  } catch (error) {
    console.error('New filing form error:', error);
    res.status(500).render('error', { message: 'Failed to load filing form' });
  }
});

router.post('/', upload.array('files', 10), async (req, res) => {
  const files = getRequestFiles(req);
  try {
    const db = getDatabase();
    Filing.setDB(db);
    Attachment.setDB(db);
    const actor = getActor(req);
    const filingData = normalizeFilingInput(req.body);
    const schema = await validateDraftInput(db, filingData, actor.department);
    if (!canCreateFiling(actor, schema)) return res.status(403).json({ error: 'You cannot create this filing type' });

    const categories = getCategories(req, files.length);
    const newFiling = await Filing.create({ ...filingData, submitted_by: actor.id });

    try {
      await createAttachments({ db, filing: newFiling, files, categories, uploadedBy: actor.id });
    } catch (error) {
      await db.collection('filings').deleteOne({ _id: newFiling._id });
      throw error;
    }

    await db.collection('timeline_entries').insertOne({
      status: 'draft', note: 'Filing created', timestamp: new Date(),
      filing_number: newFiling.filing_number, changed_by: new ObjectId(actor.id)
    });
    await logActivity(new ObjectId(actor.id), 'create', `Created filing ${newFiling.filing_number}`, 'filing', newFiling.filing_number, req);

    res.status(201).json({ success: true, filing_number: newFiling.filing_number, redirect: `/filings/${newFiling.filing_number}` });
  } catch (error) {
    console.error('Filing creation error:', error);
    res.status(400).json({ error: error.message || 'Failed to create filing' });
  }
});

router.get('/:filingNumber', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    Attachment.setDB(db);
    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!filing) return res.status(404).render('error', { message: 'Filing not found' });
    if (!canViewFiling(getActor(req), filing)) return renderAccessDenied(res);

    const [attachments, timeline, generatedDocs, submitter, reviewer, chargesDocs] = await Promise.all([
      Attachment.findByFilingNumber(filing.filing_number),
      db.collection('timeline_entries').find({ filing_number: filing.filing_number }).sort({ timestamp: 1 }).toArray(),
      db.collection('generated_documents').find({ filing_number: filing.filing_number }, { projection: { docx_base64: 0, pdf_base64: 0, pages: 0 } }).sort({ generated_at: -1 }).toArray(),
      db.collection('users').findOne({ _id: filing.submitted_by }),
      filing.da_reviewer ? db.collection('users').findOne({ _id: filing.da_reviewer }) : null,
      db.collection('charges').find({ code: { $in: filing.charges || [] } }).toArray()
    ]);
    const actorIds = [...new Set(timeline.map(entry => entry.changed_by?.toString()).filter(Boolean))];
    const actors = actorIds.length > 0 ? await db.collection('users').find({ _id: { $in: actorIds.map(id => new ObjectId(id)) } }).toArray() : [];
    const actorMap = Object.fromEntries(actors.map(user => [user._id.toString(), user]));
    const chargeMap = Object.fromEntries(chargesDocs.map(charge => [charge.code, charge]));
    const actor = getActor(req);

    await logActivity(new ObjectId(actor.id), 'view', `Viewed filing ${filing.filing_number}`, 'filing', filing.filing_number, req);
    res.render('filings/detail', {
      title: `Filing ${filing.filing_number} - LSPD DA Filing System`, currentPage: 'filings', filing,
      attachments, timeline, generatedDocs, submitter, reviewer, actorMap, chargeMap,
      REVISION_REASON_LABELS, FILING_TYPES: getFilingTypesForDepartment('LSPD'),
      isOwner: String(filing.submitted_by) === String(actor.id)
    });
  } catch (error) {
    console.error('Filing detail error:', error);
    res.status(500).render('error', { message: 'Failed to load filing' });
  }
});

router.get('/:filingNumber/edit', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    Attachment.setDB(db);
    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!canEditFiling(getActor(req), filing)) return res.status(404).render('error', { message: 'Filing not found or not editable' });

    const [charges, attachments] = await Promise.all([
      db.collection('charges').find().sort({ code: 1 }).toArray(),
      Attachment.findByFilingNumber(filing.filing_number)
    ]);
    res.render('filings/form', {
      title: `Edit Filing ${filing.filing_number} - LSPD DA Filing System`, currentPage: 'filings', editFiling: filing,
      charges, attachments, ATTACHMENT_TYPES, REVISION_REASON_LABELS,
      FILING_TYPES: getFilingTypesForDepartment(getActor(req).department),
      FILING_SCHEMAS: JSON.stringify({ [filing.filing_type]: getFilingSchema(filing.filing_type) }),
      DEPARTMENTS, POSITIONS
    });
  } catch (error) {
    console.error('Filing edit error:', error);
    res.status(500).render('error', { message: 'Failed to load filing for editing' });
  }
});

router.put('/:filingNumber', upload.array('files', 10), async (req, res) => {
  const files = getRequestFiles(req);
  try {
    const db = getDatabase();
    Filing.setDB(db);
    Attachment.setDB(db);
    const actor = getActor(req);
    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!canEditFiling(actor, filing)) return res.status(404).json({ error: 'Filing not found or not editable' });

    const filingData = normalizeFilingInput(req.body);
    const schema = await validateDraftInput(db, filingData, actor.department);
    if (filingData.filing_type !== filing.filing_type && !canCreateFiling(actor, schema)) return res.status(403).json({ error: 'Invalid filing type' });
    const categories = getCategories(req, files.length);

    const updated = await Filing.updateDraft(filing._id, filingData);
    if (!updated) return res.status(409).json({ error: 'The filing changed before it could be saved. Refresh and try again.' });
    await createAttachments({ db, filing: { ...filing, ...filingData }, files, categories, uploadedBy: actor.id });

    await logActivity(new ObjectId(actor.id), 'edit', `Updated filing ${filing.filing_number}`, 'filing', filing.filing_number, req);
    res.json({ success: true, message: 'Filing updated', filing_number: filing.filing_number });
  } catch (error) {
    console.error('Filing update error:', error);
    res.status(400).json({ error: error.message || 'Failed to update filing' });
  }
});

router.post('/:filingNumber/submit', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    const actor = getActor(req);
    const { attestation_confirmed, password } = req.body;
    if (attestation_confirmed !== true || !password) return res.status(400).json({ error: 'Password confirmation and attestation are required' });

    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!canEditFiling(actor, filing)) return res.status(404).json({ error: 'Filing not found or not in a submittable state' });

    const user = await db.collection('users').findOne({ _id: new ObjectId(actor.id) });
    if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: 'Password verification failed' });

    const validation = validateFilingInput(filing, { department: actor.department, chargeCodes: await getChargeCodes(db), requireComplete: true });
    if (!validation.valid) return res.status(400).json({ error: validation.errors.join('. ') });
    if (validation.schema.requirements.officerSignature) {
      const signature = await db.collection('attachments').findOne({ filing_number: filing.filing_number, category: 'officer_signature' });
      if (!signature) return res.status(400).json({ error: 'Officer signature image is required before submitting' });
    }

    const submitted = await Filing.submit(filing._id, { password_verified: true, attested_by: actor.id });
    if (!submitted) return res.status(409).json({ error: 'The filing state changed before it could be submitted. Refresh and try again.' });

    await db.collection('timeline_entries').insertOne({
      status: 'submitted', note: 'Filing submitted to DA with verified e-signature attestation', timestamp: new Date(),
      filing_number: filing.filing_number, changed_by: new ObjectId(actor.id)
    });
    await logActivity(new ObjectId(actor.id), 'submit', `Submitted filing ${filing.filing_number} to DA`, 'filing', filing.filing_number, req);
    res.json({ success: true, message: 'Filing submitted to DA for review' });
  } catch (error) {
    console.error('Filing submit error:', error);
    res.status(500).json({ error: 'Failed to submit filing' });
  }
});

router.post('/:filingNumber/attachments', upload.array('files', 10), async (req, res) => {
  const files = getRequestFiles(req);
  try {
    const db = getDatabase();
    Filing.setDB(db);
    Attachment.setDB(db);
    const actor = getActor(req);
    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!canEditFiling(actor, filing)) return res.status(404).json({ error: 'Filing not found or not editable' });
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const attachments = await createAttachments({ db, filing, files, categories: getCategories(req, files.length), uploadedBy: actor.id });
    await Promise.all(attachments.map(attachment => logActivity(new ObjectId(actor.id), 'create', `Uploaded attachment ${attachment.original_name} to filing ${filing.filing_number}`, 'document', attachment._id.toString(), req)));
    res.status(201).json({ success: true, attachments });
  } catch (error) {
    cleanupUploadedFiles(files);
    console.error('Attachment upload error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload attachments' });
  }
});

router.delete('/:filingNumber/attachments/:attachmentId', async (req, res) => {
  try {
    const db = getDatabase();
    Filing.setDB(db);
    Attachment.setDB(db);
    const actor = getActor(req);
    const filing = await Filing.findByFilingNumber(req.params.filingNumber);
    if (!canEditFiling(actor, filing)) return res.status(404).json({ error: 'Filing not found or not editable' });

    const attachment = await Attachment.findById(req.params.attachmentId);
    if (!attachment || attachment.filing_number !== filing.filing_number) return res.status(404).json({ error: 'Attachment not found' });

    // Delete from GridFS if stored there, otherwise fall back to disk
    if (attachment.gridfs_id) {
      await deleteFileFromGridFS(db, attachment.gridfs_id);
    } else {
      const filePath = resolveAttachmentPath(attachment);
      removeStoredFile(filePath);
    }
    await Attachment.deleteById(attachment._id);

    await logActivity(new ObjectId(actor.id), 'delete', `Removed attachment from filing ${filing.filing_number}`, 'document', attachment._id.toString(), req);
    res.json({ success: true, message: 'Attachment removed' });
  } catch (error) {
    console.error('Attachment delete error:', error);
    res.status(500).json({ error: 'Failed to remove attachment' });
  }
});

module.exports = router;
