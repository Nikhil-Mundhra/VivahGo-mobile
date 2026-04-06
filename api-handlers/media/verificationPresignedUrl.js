const { randomUUID } = require('crypto');

const { applyRateLimit, connectDb, handlePreflight, requireCsrfProtection, setCorsHeaders, verifySession } = require('../../api/_lib/core');
const { createB2PresignedPutUrl } = require('../../api/_lib/b2');
const { readJsonBody } = require('./readJsonBody');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

module.exports = async function handleVerificationPresignedUrl(req, res) {
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

  if (applyRateLimit(req, res, 'media:verification-presigned-url', {
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: 'Too many verification upload requests. Please try again shortly.',
  })) {
    return;
  }

  const { auth, error: authError, status = 401 } = verifySession(req);
  if (authError) {
    return res.status(status).json({ error: authError });
  }

  // ---------------------
  // Body parsing and validation
  // ---------------------
  let body = {};
  try {
    body = await readJsonBody(req, { maxBytes: 256 * 1024 });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.publicMessage || 'Request body must be valid JSON.' });
  }

  const { filename, contentType, size } = body || {};
  const contentLength = Number(size);

  if (!filename || typeof filename !== 'string' || !contentType || typeof contentType !== 'string') {
    return res.status(400).json({ error: 'filename and contentType are required.' });
  }

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return res.status(400).json({ error: 'size must be a positive number.' });
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Only PDF, JPG, PNG, and WebP files are allowed.' });
  }

  if (contentLength > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File exceeds the 10 MB size limit.' });
  }

  const rawExt = filename.includes('.') ? filename.split('.').pop() : '';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const key = `vendor-verification/${auth.sub}/${randomUUID()}${ext ? `.${ext}` : ''}`;

  try {
    // ---------------------
    // Presigned upload generation
    // ---------------------
    await connectDb();
    const uploadUrl = await createB2PresignedPutUrl(key, contentType, {
      contentLength,
    });

    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    // ---------------------
    // Error handling
    // ---------------------
    console.error('Verification presigned URL generation failed:', error);
    return res.status(500).json({ error: 'Could not generate verification upload URL.' });
  }
};
