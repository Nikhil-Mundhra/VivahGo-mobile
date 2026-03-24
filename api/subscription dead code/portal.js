const {
  handlePreflight,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { error } = verifySession(req);
  if (error) {
    return res.status(401).json({ error });
  }

  return res.status(501).json({
    error: 'Razorpay self-serve subscription management is not configured. Choose a new plan from pricing instead.',
  });
};
