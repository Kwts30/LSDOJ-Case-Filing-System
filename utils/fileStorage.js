const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const EVIDENCE_DIR = path.join(UPLOAD_ROOT, 'evidence');

function ensureEvidenceDirectory() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
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
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  EVIDENCE_DIR,
  ensureEvidenceDirectory,
  storageKeyFor,
  resolveStorageKey,
  resolveAttachmentPath,
  removeStoredFile
};
