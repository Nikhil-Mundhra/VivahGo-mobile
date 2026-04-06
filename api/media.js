const handleAppUpload = require('../api-handlers/media/appUpload');
const handlePresignedUrl = require('../api-handlers/media/presignedUrl');
const handleVerificationPresignedUrl = require('../api-handlers/media/verificationPresignedUrl');

// ---------------------
// Route map
// ---------------------
const ROUTE_HANDLERS = {
  'app-upload': handleAppUpload,
  'presigned-url': handlePresignedUrl,
  'verification-presigned-url': handleVerificationPresignedUrl,
};

module.exports = async function handler(req, res) {
  // ---------------------
  // Route dispatch
  // ---------------------
  const route = String(req.query?.route || '').trim().toLowerCase();
  const routeHandler = ROUTE_HANDLERS[route];

  if (!routeHandler) {
    res.setHeader('Allow', 'OPTIONS, POST');
    return res.status(404).json({ error: 'Not found.' });
  }

  return routeHandler(req, res);
};

// ---------------------
// Vercel config
// ---------------------
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
