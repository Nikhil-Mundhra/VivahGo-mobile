const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
const {
  connectDb,
  getUserModel,
  handlePreflight,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

const DEFAULT_SUBSCRIPTION_AMOUNT_MAP = {
  premium: { monthly: 200000, yearly: 1920000 },
  studio: { monthly: 500000, yearly: 4800000 },
};

const COUPON_FILE_PATH = path.join(__dirname, '..', '..', 'config', 'subscription-coupons.json');

function resolveSubscriptionAmount(plan, billingCycle) {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const envKey = `RAZORPAY_${plan.toUpperCase()}_${cycle.toUpperCase()}_AMOUNT`;
  const fromEnv = Number(process.env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }

  return DEFAULT_SUBSCRIPTION_AMOUNT_MAP[plan]?.[cycle] || 0;
}

function readCouponCatalog() {
  try {
    return JSON.parse(fs.readFileSync(COUPON_FILE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function resolveCoupon(couponCode) {
  const normalizedCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
  if (!normalizedCode) {
    return null;
  }

  const coupon = readCouponCatalog().find((entry) => entry?.code === normalizedCode);
  if (!coupon) {
    throw new Error('Coupon code is invalid.');
  }

  const expiresAt = Date.parse(coupon.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    throw new Error('Coupon code has expired.');
  }

  const discountPercent = Number(coupon.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
    throw new Error('Coupon discount is invalid.');
  }

  return {
    code: normalizedCode,
    expiresAt: coupon.expiresAt,
    discountPercent,
  };
}

function applyCouponDiscount(amount, coupon) {
  if (!coupon) {
    return amount;
  }

  return Math.round(amount * (100 - coupon.discountPercent) / 100);
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

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpayKeyId || !razorpayKeySecret) {
    return res.status(500).json({ error: 'Payment gateway is not configured.' });
  }

  const { plan, billingCycle, couponCode } = req.body || {};

  if (!plan || !['premium', 'studio'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
  }

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const baseAmount = resolveSubscriptionAmount(plan, cycle);
  if (!baseAmount) {
    return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });
  }

  try {
    await connectDb();
    const User = getUserModel();
    const user = await User.findOne({ googleId: auth.sub }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const coupon = resolveCoupon(couponCode);
    const amount = applyCouponDiscount(baseAmount, coupon);

    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `vivahgo_${plan}_${Date.now()}`,
      notes: {
        googleId: auth.sub,
        plan,
        billingCycle: cycle,
        email: user.email,
        couponCode: coupon?.code || '',
      },
    });

    return res.status(200).json({
      keyId: razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      baseAmount,
      currency: order.currency,
      name: 'VivahGo',
      description: `${plan === 'studio' ? 'Studio' : 'Premium'} ${cycle === 'yearly' ? 'yearly' : 'monthly'} plan`,
      appliedCoupon: coupon,
      prefill: {
        name: user.name,
        email: user.email,
      },
      notes: order.notes || {},
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    const statusCode = /coupon/i.test(err?.message || '') ? 400 : 500;
    return res.status(statusCode).json({ error: err?.message || 'Failed to create checkout order.' });
  }
};
