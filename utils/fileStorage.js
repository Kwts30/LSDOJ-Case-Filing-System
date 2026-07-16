const fs = require('fs');
const path = require('path');
const { GridFSBucket, ObjectId } = require('mongodb');

// ─── Legacy local disk paths (fallback for pre-GridFS records) ────────────────
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const EVIDENCE_DIR = path.join(UPLOAD_ROOT, 'evidence');

function ensureEvidenceDirectory() {
  try {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  } catch (e) {
    // On Vercel the filesystem is read-only — silently ignore.
    // All new uploads go to GridFS instead.
  }
  return EVIDENCE_DIR;
}

function storageKeyFor(fileName) {
  return path.posix.join('evidence', fileName);
}

function resolveStorageKey(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') return null;
  const absolutePath = path.resolve(UPLOAD_ROOT, storageKey);
  const relative = path.relative(UPLOAD_ROOT, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return absolutePath;
}

function resolveAttachmentPath(attachment) {
  if (!attachment) return null;
  if (attachment.storage_key) return resolveStorageKey(attachment.storage_key);

  // Backward-compatible support for protected serving of existing records.
  const legacyPath = String(attachment.file_url || '');
  if (!legacyPath.startsWith('/uploads/evidence/')) return null;
  return resolveStorageKey(storageKeyFor(path.basename(legacyPath)));
}

function removeStoredFile(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  const relative = path.relative(UPLOAD_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  try {
    fs.unlinkSync(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Could not remove file (may be on read-only FS):', error.message);
    }
  }
}

// ─── GridFS helpers ───────────────────────────────────────────────────────────

/**
 * Upload a buffer to GridFS.
 *
 * @param {import('mongodb').Db} db
 * @param {Buffer} buffer - File content
 * @param {string} filename - Stored filename (for metadata)
 * @param {string} mimeType - MIME type for metadata
 * @returns {Promise<string>} - GridFS file _id as hex string
 */
async function storeFileInGridFS(db, buffer, filename, mimeType) {
  const bucket = new GridFSBucket(db, { bucketName: 'attachments' });
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { mimeType }
    });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id.toString()));
    uploadStream.end(buffer);
  });
}

/**
 * Stream a GridFS file to an Express response.
 *
 * @param {import('mongodb').Db} db
 * @param {string} gridfsId - GridFS file _id hex string
 * @param {import('express').Response} res
 */
async function streamFileFromGridFS(db, gridfsId, res) {
  const bucket = new GridFSBucket(db, { bucketName: 'attachments' });
  const id = new ObjectId(gridfsId);

  // Verify file exists first
  const files = await bucket.find({ _id: id }).toArray();
  if (!files.length) {
    res.status(404).end();
    return;
  }

  const downloadStream = bucket.openDownloadStream(id);
  downloadStream.on('error', (err) => {
    console.error('GridFS stream error:', err);
    if (!res.headersSent) res.status(500).end();
  });
  downloadStream.pipe(res);
}

/**
 * Delete a file from GridFS by its _id hex string.
 *
 * @param {import('mongodb').Db} db
 * @param {string} gridfsId
 */
async function deleteFileFromGridFS(db, gridfsId) {
  try {
    const bucket = new GridFSBucket(db, { bucketName: 'attachments' });
    await bucket.delete(new ObjectId(gridfsId));
  } catch (e) {
    // Ignore if already deleted
    if (e.message && !e.message.includes('FileNotFound')) {
      console.warn('GridFS delete warning:', e.message);
    }
  }
}

module.exports = {
  EVIDENCE_DIR,
  ensureEvidenceDirectory,
  storageKeyFor,
  resolveStorageKey,
  resolveAttachmentPath,
  removeStoredFile,
  storeFileInGridFS,
  streamFileFromGridFS,
  deleteFileFromGridFS
};
