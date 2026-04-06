const { handlePreflight, setCorsHeaders } = require('./_lib/core');
const { handlePlannerPublic } = require('./planner');

async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);
  return handlePlannerPublic(req, res);
}

module.exports = handler;
