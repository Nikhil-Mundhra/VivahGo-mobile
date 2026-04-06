const { handlePreflight, setCorsHeaders } = require('./_lib/core');
const { handleVendorList } = require('./vendor');

async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);
  return handleVendorList(req, res);
}

module.exports = handler;
