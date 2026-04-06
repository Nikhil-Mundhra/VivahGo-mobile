const { handlePreflight, requireCsrfProtection, setCorsHeaders } = require('../../api/_lib/core');
const { requireAdminSession } = require('../../api/_lib/admin');
const {
  ALLOWED_PUBLIC_IMAGE_TYPES,
  MAX_BLOB_SERVER_UPLOAD_SIZE,
  buildPublicMediaBlobPath,
  normalizeBlobMediaFolder,
  readRequestBodyBuffer,
  uploadPublicBlob,
} = require('../../api/_lib/blob');

module.exports = async function handleAppUpload(req, res) {
  // ---------------------
  // Request guardrails
  // ---------------------
  if (handlePreflight(req, res)) { return; }
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  try {
    // ---------------------
    // Session and input validation
    // ---------------------
    const session = await requireAdminSession(req, 'editor');
    if (session.error) {
      return res.status(session.status).json({ error: session.error });
    }

    const filename = String(req.query?.filename || '').trim();
    const folder = normalizeBlobMediaFolder(req.query?.folder || 'app');
    const contentType = String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
    const contentLength = Number(req.headers?.['content-length']);

    if (!filename) {
      return res.status(400).json({ error: 'filename query parameter is required.' });
    }
    if (!folder) {
      return res.status(400).json({ error: 'folder must be one of: app, guides, marketing.' });
    }
    if (!ALLOWED_PUBLIC_IMAGE_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WebP, AVIF, and GIF images are allowed.' });
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_BLOB_SERVER_UPLOAD_SIZE) {
      return res.status(400).json({ error: 'File exceeds the 4.5 MB server upload limit for Vercel Blob.' });
    }

    const body = await readRequestBodyBuffer(req, { maxBytes: MAX_BLOB_SERVER_UPLOAD_SIZE });
    if (!body.length) {
      return res.status(400).json({ error: 'Request body must contain a file.' });
    }

    // ---------------------
    // Blob upload
    // ---------------------
    const pathname = buildPublicMediaBlobPath({ folder, filename });
    const blob = await uploadPublicBlob({
      pathname,
      body,
      contentType,
    });

    return res.status(200).json({
      folder,
      pathname,
      size: body.length,
      uploadedBy: session.user.googleId || '',
      blob,
    });
  } catch (error) {
    // ---------------------
    // Error handling
    // ---------------------
    const message = String(error?.message || '');
    if (message.includes('Request body exceeds')) {
      return res.status(400).json({ error: 'File exceeds the 4.5 MB server upload limit for Vercel Blob.' });
    }

    console.error('App media Blob upload failed:', error);
    return res.status(500).json({ error: 'Could not upload app media.' });
  }
};
