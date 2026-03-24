const Stripe = require('stripe');
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

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error } = verifySession(req);
  if (error) {
    return res.status(401).json({ error });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Payment gateway is not configured.' });
  }

  const clientOrigin = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim() || 'http://localhost:5173';
  const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || clientOrigin;

  try {
    await connectDb();
    const User = getUserModel();
    const user = await User.findOne({ googleId: auth.sub }).lean();

    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found to manage.' });
    }

    const stripe = Stripe(stripeSecretKey);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error('Portal session creation failed:', err);
    return res.status(500).json({ error: 'Failed to open subscription management portal.' });
  }
};
