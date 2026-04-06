const handleFeedback = require('../api-handlers/system/feedback');
const handleHealth = require('../api-handlers/system/health');

// ---------------------
// Route map
// ---------------------
const ROUTE_HANDLERS = {
  feedback: handleFeedback,
  health: handleHealth,
};

module.exports = async function handler(req, res) {
  // ---------------------
  // Route dispatch
  // ---------------------
  const route = String(req.query?.route || '').trim().toLowerCase();
  const routeHandler = ROUTE_HANDLERS[route];

  if (!routeHandler) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(404).json({ error: 'Not found.' });
  }

  return routeHandler(req, res);
};
