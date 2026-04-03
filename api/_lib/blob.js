const { randomUUID } = require('crypto');
const { put } = require('@vercel/blob');

const MAX_BLOB_SERVER_UPLOAD_SIZE = Math.floor(4.5 * 1024 * 1024);
const ALLOWED_PUBLIC_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);
const ALLOWED_PUBLIC_MEDIA_FOLDERS = new Set([
  'app',
  'guides',
  'marketing',
]);

function normalizeBlobMediaFolder(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9/-]+/g, '-');
  if (!normalized) {
    return 'app';
  }

  return ALLOWED_PUBLIC_MEDIA_FOLDERS.has(normalized) ? normalized : '';
}

function sanitizeFilenamePart(value, fallback = 'upload') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || fallback;
}

function extractSafeExtension(filename, fallback = 'bin') {
  const raw = String(filename || '').trim().split('.').pop() || '';
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  return normalized || fallback;
}

function buildPublicMediaBlobPath({ folder = 'app', filename = '' } = {}) {
  const normalizedFolder = normalizeBlobMediaFolder(folder);
  if (!normalizedFolder) {
    throw new Error('folder must be one of: app, guides, marketing.');
  }

  const originalName = String(filename || '').trim();
  if (!originalName) {
    throw new Error('filename is required.');
  }

  const basename = originalName.includes('.') ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
  const safeName = sanitizeFilenamePart(basename, 'asset');
  const ext = extractSafeExtension(originalName);
  const createdAt = new Date();
  const year = String(createdAt.getUTCFullYear());
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');

  return `app-media/${normalizedFolder}/${year}/${month}/${randomUUID()}-${safeName}.${ext}`;
}

async function readRequestBodyBuffer(req, options = {}) {
  const maxBytes = Number.isFinite(Number(options.maxBytes))
    ? Math.max(1, Math.trunc(Number(options.maxBytes)))
    : MAX_BLOB_SERVER_UPLOAD_SIZE;

  if (Buffer.isBuffer(req?.body)) {
    if (req.body.length > maxBytes) {
      throw new Error(`Request body exceeds the ${maxBytes} byte limit.`);
    }
    return req.body;
  }

  if (typeof req?.body === 'string') {
    const bodyBuffer = Buffer.from(req.body);
    if (bodyBuffer.length > maxBytes) {
      throw new Error(`Request body exceeds the ${maxBytes} byte limit.`);
    }
    return bodyBuffer;
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;
    if (totalBytes > maxBytes) {
      throw new Error(`Request body exceeds the ${maxBytes} byte limit.`);
    }
    chunks.push(bufferChunk);
  }

  return Buffer.concat(chunks);
}

async function uploadPublicBlob({ pathname, body, contentType, token } = {}) {
  if (!pathname || typeof pathname !== 'string') {
    throw new Error('pathname is required.');
  }
  if (!Buffer.isBuffer(body) || !body.length) {
    throw new Error('body must be a non-empty Buffer.');
  }
  if (!ALLOWED_PUBLIC_IMAGE_TYPES.has(contentType)) {
    throw new Error('Unsupported Blob content type.');
  }

  return put(pathname, body, {
    access: 'public',
    addRandomSuffix: false,
    contentType,
    token: token || process.env.BLOB_READ_WRITE_TOKEN,
  });
}

module.exports = {
  ALLOWED_PUBLIC_IMAGE_TYPES,
  ALLOWED_PUBLIC_MEDIA_FOLDERS,
  MAX_BLOB_SERVER_UPLOAD_SIZE,
  buildPublicMediaBlobPath,
  normalizeBlobMediaFolder,
  readRequestBodyBuffer,
  uploadPublicBlob,
};
