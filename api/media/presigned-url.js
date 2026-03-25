const { randomUUID } = require('crypto');
const { connectDb, handlePreflight, setCorsHeaders, verifySession } = require('../_lib/core');
const { createPresignedPutUrl, createPublicObjectUrl } = require('../_lib/r2');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) { return; }
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error: authError } = verifySession(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const { filename, contentType, size } = req.body || {};

  if (!filename || typeof filename !== 'string' || !contentType || typeof contentType !== 'string') {
    return res.status(400).json({ error: 'filename and contentType are required.' });
  }

  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return res.status(400).json({ error: 'Only image and video files are allowed.' });
  }

  if (typeof size === 'number' && size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File exceeds the 50 MB size limit.' });
  }

  // Sanitize extension: allow only alphanumeric characters
  const rawExt = filename.includes('.') ? filename.split('.').pop() : '';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const key = `vendors/${auth.sub}/${randomUUID()}${ext ? `.${ext}` : ''}`;

  try {
    await connectDb();
    const uploadUrl = await createPresignedPutUrl(key, contentType);
    const publicUrl = createPublicObjectUrl(key);

    return res.status(200).json({ uploadUrl, key, publicUrl });
  } catch (error) {
    console.error('Presigned URL generation failed:', error);
    return res.status(500).json({ error: 'Could not generate upload URL.' });
  }
};
