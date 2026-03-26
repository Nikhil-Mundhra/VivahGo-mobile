const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const {
  connectDb,
  getBillingReceiptModel,
  getUserModel,
  handlePreflight,
  setCorsHeaders,
  verifySession,
} = require('./_lib/core');

const DEFAULT_SUBSCRIPTION_AMOUNT_MAP = {
  premium: { monthly: 200000, yearly: 1920000 },
  studio: { monthly: 500000, yearly: 4800000 },
};

const COUPON_SECRET_FILE_PATH = path.join(__dirname, '..', 'config', 'subscription-coupons.local.json');

function resolveSubscriptionAmount(plan, billingCycle) {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const envKey = `RAZORPAY_${plan.toUpperCase()}_${cycle.toUpperCase()}_AMOUNT`;
  const fromEnv = Number(process.env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_SUBSCRIPTION_AMOUNT_MAP[plan]?.[cycle] || 0;
}

function readCouponCatalog() {
  const rawCatalog = process.env.SUBSCRIPTION_COUPONS_JSON;
  if (rawCatalog) {
    try {
      return JSON.parse(rawCatalog);
    } catch {
      return [];
    }
  }

  try {
    return JSON.parse(fs.readFileSync(COUPON_SECRET_FILE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function resolveCoupon(couponCode, plan) {
  const normalizedCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
  if (!normalizedCode) return null;

  const coupon = readCouponCatalog().find((entry) => entry?.code === normalizedCode);
  if (!coupon) throw new Error('Coupon code is invalid.');

  const expiresAt = Date.parse(coupon.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) throw new Error('Coupon code has expired.');

  const discountPercent = Number(coupon.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    throw new Error('Coupon discount is invalid.');
  }

  const applicablePlans = Array.isArray(coupon.applicablePlans)
    ? coupon.applicablePlans.filter(entry => entry === 'premium' || entry === 'studio')
    : [];
  if (plan && applicablePlans.length > 0 && !applicablePlans.includes(plan)) {
    throw new Error('Coupon code is not valid for this plan.');
  }

  return { code: normalizedCode, expiresAt: coupon.expiresAt, discountPercent, applicablePlans };
}

function applyCouponDiscount(amount, coupon) {
  if (!coupon) return amount;
  return Math.round((amount * (100 - coupon.discountPercent)) / 100);
}

function buildSubscriptionPeriodEnd(billingCycle, startDate = new Date()) {
  const next = new Date(startDate);
  if (billingCycle === 'yearly') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function tierForPlan(plan) {
  if (plan === 'studio') return 'studio';
  if (plan === 'premium') return 'premium';
  return 'starter';
}

function generateReceiptNumber(plan) {
  const prefix = plan === 'studio' ? 'VGS' : 'VGP';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function serializeReceipt(receipt = {}) {
  const plain = typeof receipt?.toObject === 'function' ? receipt.toObject() : receipt;
  return {
    id: String(plain._id || ''),
    receiptNumber: plain.receiptNumber || '',
    email: plain.email || '',
    plan: plain.plan || '',
    billingCycle: plain.billingCycle || '',
    currency: plain.currency || 'INR',
    baseAmount: Number(plain.baseAmount || 0),
    amount: Number(plain.amount || 0),
    couponCode: plain.couponCode || '',
    discountPercent: Number(plain.discountPercent || 0),
    paymentProvider: plain.paymentProvider || 'internal',
    paymentReference: plain.paymentReference || '',
    status: plain.status || 'issued',
    emailDeliveryStatus: plain.emailDeliveryStatus || 'pending',
    emailDeliveryError: plain.emailDeliveryError || '',
    issuedAt: plain.issuedAt || null,
    currentPeriodEnd: plain.currentPeriodEnd || null,
  };
}

async function sendBillingReceiptEmail({ toEmail, userName, receipt }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const billingFromEmail = process.env.BILLING_FROM_EMAIL;
  if (!resendApiKey || !billingFromEmail || !toEmail) {
    return { status: 'skipped', error: '' };
  }

  const periodEnd = receipt.currentPeriodEnd
    ? new Date(receipt.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not available';

  const amountInRupees = (Number(receipt.amount || 0) / 100).toFixed(2);
  const baseAmountInRupees = (Number(receipt.baseAmount || 0) / 100).toFixed(2);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">VivahGo Billing Receipt</h2>
      <p>Hello ${userName || 'there'},</p>
      <p>Your ${receipt.plan} plan receipt has been generated successfully.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
        <tr><td style="padding: 6px 0; font-weight: 600;">Receipt number</td><td style="padding: 6px 0;">${receipt.receiptNumber}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Plan</td><td style="padding: 6px 0; text-transform: capitalize;">${receipt.plan}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Billing cycle</td><td style="padding: 6px 0; text-transform: capitalize;">${receipt.billingCycle}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Base amount</td><td style="padding: 6px 0;">INR ${baseAmountInRupees}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Discount</td><td style="padding: 6px 0;">${receipt.discountPercent}%${receipt.couponCode ? ` (${receipt.couponCode})` : ''}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Amount billed</td><td style="padding: 6px 0;">INR ${amountInRupees}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Valid until</td><td style="padding: 6px 0;">${periodEnd}</td></tr>
      </table>
      <p style="margin-top: 18px;">Thank you for choosing VivahGo.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: billingFromEmail,
      to: [toEmail],
      subject: `VivahGo receipt ${receipt.receiptNumber}`,
      html,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Email delivery failed (${response.status}).`);
  }

  return { status: 'sent', error: '' };
}

async function persistReceiptAndSubscription({ auth, user, plan, cycle, baseAmount, amount, coupon, paymentProvider, paymentReference }) {
  const User = getUserModel();
  const BillingReceipt = getBillingReceiptModel();
  const currentPeriodEnd = buildSubscriptionPeriodEnd(cycle);
  const receiptPayload = {
    googleId: auth.sub,
    email: user.email,
    receiptNumber: generateReceiptNumber(plan),
    plan,
    billingCycle: cycle,
    currency: 'INR',
    baseAmount,
    amount,
    couponCode: coupon?.code || '',
    discountPercent: Number(coupon?.discountPercent || 0),
    paymentProvider,
    paymentReference: paymentReference || '',
    status: amount === 0 ? 'issued' : 'paid',
    emailDeliveryStatus: 'pending',
    issuedAt: new Date(),
    currentPeriodEnd,
    meta: {
      applicablePlans: coupon?.applicablePlans || [],
    },
  };

  const createdReceipt = await BillingReceipt.create(receiptPayload);

  await User.updateOne(
    { googleId: auth.sub },
    {
      $set: {
        subscriptionId: paymentReference || createdReceipt.receiptNumber,
        subscriptionTier: tierForPlan(plan),
        subscriptionStatus: 'active',
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
      },
    }
  );

  try {
    const emailResult = await sendBillingReceiptEmail({
      toEmail: user.email,
      userName: user.name,
      receipt: serializeReceipt(createdReceipt),
    });
    await BillingReceipt.updateOne(
      { _id: createdReceipt._id },
      {
        $set: {
          emailDeliveryStatus: emailResult.status,
          emailDeliveryError: emailResult.error || '',
        },
      }
    );
    return {
      receipt: {
        ...serializeReceipt(createdReceipt),
        emailDeliveryStatus: emailResult.status,
        emailDeliveryError: emailResult.error || '',
      },
      currentPeriodEnd,
    };
  } catch (error) {
    await BillingReceipt.updateOne(
      { _id: createdReceipt._id },
      {
        $set: {
          emailDeliveryStatus: 'failed',
          emailDeliveryError: error.message || 'Email delivery failed.',
        },
      }
    );
    return {
      receipt: {
        ...serializeReceipt(createdReceipt),
        emailDeliveryStatus: 'failed',
        emailDeliveryError: error.message || 'Email delivery failed.',
      },
      currentPeriodEnd,
    };
  }
}

function verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return expected === signature;
}

function collectRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

function getOperation(req) {
  const queryOp = req.query?.op;
  if (typeof queryOp === 'string' && queryOp) return queryOp;

  const url = req.url || '';
  if (url.includes('/status')) return 'status';
  if (url.includes('/quote')) return 'quote';
  if (url.includes('/checkout')) return 'checkout';
  if (url.includes('/confirm')) return 'confirm';
  if (url.includes('/portal')) return 'portal';
  if (url.includes('/webhook')) return 'webhook';
  return '';
}

module.exports = async function handler(req, res) {
  const op = getOperation(req);

  // #---------------------------------------------------------------------------
  // #---- /api/subscription/status
  // #---------------------------------------------------------------------------
  if (op === 'status') {
    if (handlePreflight(req, res)) return;
    setCorsHeaders(req, res);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const { auth, error } = verifySession(req);
    if (error) return res.status(401).json({ error });

    try {
      await connectDb();
      const User = getUserModel();
      const user = await User.findOne({ googleId: auth.sub }).lean();

      if (!user) return res.status(200).json({ tier: 'starter', status: 'active', currentPeriodEnd: null });

      return res.status(200).json({
        tier: user.subscriptionTier || 'starter',
        status: user.subscriptionStatus || 'active',
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
      });
    } catch (err) {
      console.error('Subscription status failed:', err);
      return res.status(500).json({ error: 'Failed to load subscription status.' });
    }
  }

  // #---------------------------------------------------------------------------
  // #---- /api/subscription/quote
  // #---------------------------------------------------------------------------
  if (op === 'quote') {
    if (handlePreflight(req, res)) return;
    setCorsHeaders(req, res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const { error } = verifySession(req);
    if (error) return res.status(401).json({ error });

    const { plan, billingCycle, couponCode } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const baseAmount = resolveSubscriptionAmount(plan, cycle);
    if (!baseAmount) return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });

    try {
      const coupon = resolveCoupon(couponCode, plan);
      const amount = applyCouponDiscount(baseAmount, coupon);
      return res.status(200).json({ amount, baseAmount, currency: 'INR', appliedCoupon: coupon, plan, billingCycle: cycle, requiresPayment: amount > 0 });
    } catch (err) {
      const statusCode = /coupon/i.test(err?.message || '') ? 400 : 500;
      return res.status(statusCode).json({ error: err?.message || 'Failed to calculate checkout quote.' });
    }
  }

  // #---------------------------------------------------------------------------
  // #---- /api/subscription/checkout
  // #---------------------------------------------------------------------------
  if (op === 'checkout') {
    if (handlePreflight(req, res)) return;
    setCorsHeaders(req, res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const { auth, error } = verifySession(req);
    if (error) return res.status(401).json({ error });

    const { plan, billingCycle, couponCode } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const baseAmount = resolveSubscriptionAmount(plan, cycle);
    if (!baseAmount) return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });

    try {
      await connectDb();
      const User = getUserModel();
      const user = await User.findOne({ googleId: auth.sub }).lean();
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const coupon = resolveCoupon(couponCode, plan);
      const amount = applyCouponDiscount(baseAmount, coupon);

      if (amount === 0) {
        return res.status(200).json({
          checkoutMode: 'internal_free',
          amount,
          baseAmount,
          currency: 'INR',
          appliedCoupon: coupon,
          name: 'VivahGo',
          description: `${plan === 'studio' ? 'Studio' : 'Premium'} ${cycle === 'yearly' ? 'yearly' : 'monthly'} plan`,
          prefill: { name: user.name, email: user.email },
        });
      }

      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpayKeyId || !razorpayKeySecret) {
        return res.status(500).json({ error: 'Payment gateway is not configured.' });
      }

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
        prefill: { name: user.name, email: user.email },
        notes: order.notes || {},
        checkoutMode: 'razorpay',
      });
    } catch (err) {
      console.error('Razorpay order creation failed:', err);
      const statusCode = /coupon/i.test(err?.message || '') ? 400 : 500;
      return res.status(statusCode).json({ error: err?.message || 'Failed to create checkout order.' });
    }
  }

  // #---------------------------------------------------------------------------
  // #---- /api/subscription/confirm
  // #---------------------------------------------------------------------------
  if (op === 'confirm') {
    if (handlePreflight(req, res)) return;
    setCorsHeaders(req, res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const { auth, error } = verifySession(req);
    if (error) return res.status(401).json({ error });

    const { plan, billingCycle, orderId, paymentId, signature, couponCode } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' });

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';

    try {
      await connectDb();
      const User = getUserModel();
      const user = await User.findOne({ googleId: auth.sub }).lean();
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const baseAmount = resolveSubscriptionAmount(plan, cycle);
      if (!baseAmount) return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });

      const coupon = resolveCoupon(couponCode, plan);
      const amount = applyCouponDiscount(baseAmount, coupon);

      if (amount > 0) {
        const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!razorpayKeySecret) return res.status(500).json({ error: 'Payment gateway is not configured.' });
        if (!orderId || !paymentId || !signature) return res.status(400).json({ error: 'Payment confirmation is incomplete.' });
        if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature, razorpayKeySecret)) {
          return res.status(400).json({ error: 'Payment signature verification failed.' });
        }
      }

      const result = await persistReceiptAndSubscription({
        auth,
        user,
        plan,
        cycle,
        baseAmount,
        amount,
        coupon,
        paymentProvider: amount === 0 ? 'internal' : 'razorpay',
        paymentReference: amount === 0 ? '' : paymentId,
      });
      return res.status(200).json({ success: true, receipt: result.receipt, checkoutMode: amount === 0 ? 'internal_free' : 'razorpay' });
    } catch (err) {
      console.error('Razorpay payment confirmation failed:', err);
      return res.status(500).json({ error: 'Failed to confirm payment.' });
    }
  }

  // #---------------------------------------------------------------------------
  // #---- /api/subscription/portal
  // #---------------------------------------------------------------------------
  if (op === 'portal') {
    if (handlePreflight(req, res)) return;
    setCorsHeaders(req, res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const { error } = verifySession(req);
    if (error) return res.status(401).json({ error });

    return res.status(501).json({
      error: 'Razorpay self-serve subscription management is not configured. Choose a new plan from pricing instead.',
    });
  }

  // #---------------------------------------------------------------------------
  // #---- /api/subscription/webhook
  // #---------------------------------------------------------------------------
  if (op === 'webhook') {
    setCorsHeaders(req, res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ error: 'Razorpay webhook is not configured.' });

    let rawBody;
    try {
      rawBody = await collectRawBody(req);
    } catch {
      return res.status(400).json({ error: 'Failed to read request body.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      return res.status(400).json({ error: 'Webhook signature verification failed.' });
    }

    try {
      const event = JSON.parse(rawBody.toString('utf8'));
      const payment = event?.payload?.payment?.entity;
      const notes = payment?.notes || {};

      await connectDb();
      const User = getUserModel();

      if (event?.event === 'payment.failed' && notes.googleId) {
        await User.updateOne({ googleId: notes.googleId }, { $set: { subscriptionStatus: 'inactive' } });
      }

      if (event?.event === 'refund.processed' && notes.googleId) {
        await User.updateOne(
          { googleId: notes.googleId },
          { $set: { subscriptionTier: 'starter', subscriptionStatus: 'inactive', subscriptionCurrentPeriodEnd: null } }
        );
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Razorpay webhook handler failed:', err);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(404).json({ error: 'Subscription route not found.' });
};
