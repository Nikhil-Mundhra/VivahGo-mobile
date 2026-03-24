const Stripe = require('stripe');
const {
  connectDb,
  getUserModel,
  handlePreflight,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

const PRICE_MAP = {
  premium: {
    monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
  },
  studio: {
    monthly: process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_STUDIO_YEARLY_PRICE_ID,
  },
};

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

  const { plan, billingCycle } = req.body || {};

  if (!plan || !['premium', 'studio'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
  }

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const priceId = PRICE_MAP[plan][cycle];

  if (!priceId) {
    return res.status(500).json({ error: `Price ID for ${plan} (${cycle}) is not configured.` });
  }

  const clientOrigin = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim() || 'http://localhost:5173';
  const portalReturnUrl = process.env.STRIPE_PORTAL_RETURN_URL || clientOrigin;

  try {
    await connectDb();
    const User = getUserModel();
    const user = await User.findOne({ googleId: auth.sub });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const stripe = Stripe(stripeSecretKey);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { googleId: user.googleId },
      });
      customerId = customer.id;
      await User.updateOne({ googleId: auth.sub }, { $set: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${portalReturnUrl}/?subscription=success`,
      cancel_url: `${portalReturnUrl}/?subscription=canceled`,
      subscription_data: {
        metadata: { googleId: auth.sub, plan },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout session creation failed:', err);
    return res.status(500).json({ error: 'Failed to create checkout session.' });
  }
};
