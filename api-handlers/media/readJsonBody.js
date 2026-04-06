const { readRequestBodyBuffer } = require('../../api/_lib/blob');

// ---------------------
// JSON body parsing
// ---------------------
async function readJsonBody(req, options = {}) {
  if (req?.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const bodyBuffer = await readRequestBodyBuffer(req, options);
  if (!bodyBuffer.length) {
    return {};
  }

  try {
    return JSON.parse(bodyBuffer.toString('utf8'));
  } catch (error) {
    error.statusCode = 400;
    error.publicMessage = 'Request body must be valid JSON.';
    throw error;
  }
}

module.exports = {
  readJsonBody,
};
