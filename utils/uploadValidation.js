const fs = require('fs/promises');

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isPlainTextBuffer(buffer) {
  const text = buffer.toString('utf8');
  if (text.includes('\uFFFD') || text.includes('\0')) return false;
  const controls = [...text].filter(character => {
    const code = character.charCodeAt(0);
    return code < 32 && character !== '\n' && character !== '\r' && character !== '\t';
  });
  return controls.length === 0;
}

function detectMimeFromBytes(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]))) return 'video/webm';
  return null;
}

async function validateUploadedFile(file, allowedMimeTypes) {
  const bytes = await fs.readFile(file.path);
  const detectedMime = detectMimeFromBytes(bytes.subarray(0, 16));
  const isPlainText = file.mimetype === 'text/plain' && !detectedMime && isPlainTextBuffer(bytes);
  const actualMime = detectedMime || (isPlainText ? 'text/plain' : null);

  if (!actualMime || !allowedMimeTypes.includes(actualMime)) {
    throw new Error(`Unsupported or invalid file content: ${file.originalname}`);
  }
  return actualMime;
}

function isImageMimeType(mimeType) {
  return IMAGE_MIME_TYPES.has(mimeType);
}

module.exports = {
  validateUploadedFile,
  isImageMimeType
};
