const { handlePreflight, setCorsHeaders } = require('../../api/_lib/core');

module.exports = async function handleHealth(req, res) {
  // ---------------------
  // Health response
  // ---------------------
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);
  res.status(200).json({ ok: true });
};
