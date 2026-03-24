const crypto = require('crypto');
const {
  connectDb,
  getUserModel,
  handlePreflight,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

function buildSubscriptionPeriodEnd(billingCycle, startDate = new Date()) {
  const next = new Date(startDate);
  if (billingCycle === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function tierForPlan(plan) {
  if (plan === 'studio') return 'studio';
  if (plan === 'premium') return 'premium';
  return 'starter';
}

function verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
}

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

  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpayKeySecret) {
    return res.status(500).json({ error: 'Payment gateway is not configured.' });
  }

  const { plan, billingCycle, orderId, paymentId, signature } = req.body || {};
  if (!plan || !['premium', 'studio'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan.' });
  }

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Payment confirmation is incomplete.' });
  }

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature, razorpayKeySecret)) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }

  try {
    await connectDb();
    const User = getUserModel();

    await User.updateOne(
      { googleId: auth.sub },
      {
        $set: {
          subscriptionId: paymentId,
          subscriptionTier: tierForPlan(plan),
          subscriptionStatus: 'active',
          subscriptionCurrentPeriodEnd: buildSubscriptionPeriodEnd(cycle),
        },
      }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Razorpay payment confirmation failed:', err);
    return res.status(500).json({ error: 'Failed to confirm payment.' });
  }
};
