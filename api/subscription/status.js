const {
  connectDb,
  getUserModel,
  handlePreflight,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error } = verifySession(req);
  if (error) {
    return res.status(401).json({ error });
  }

  try {
    await connectDb();
    const User = getUserModel();
    const user = await User.findOne({ googleId: auth.sub }).lean();

    if (!user) {
      return res.status(200).json({ tier: 'starter', status: 'active', currentPeriodEnd: null });
    }

    const tier = user.subscriptionTier || 'starter';
    const status = user.subscriptionStatus || 'active';
    const currentPeriodEnd = user.subscriptionCurrentPeriodEnd || null;

    return res.status(200).json({ tier, status, currentPeriodEnd });
  } catch (err) {
    console.error('Subscription status failed:', err);
    return res.status(500).json({ error: 'Failed to load subscription status.' });
  }
};
