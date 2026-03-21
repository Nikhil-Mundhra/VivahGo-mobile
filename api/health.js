const { handlePreflight, setCorsHeaders } = require('./_lib/core');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);
  res.status(200).json({ ok: true });
};
