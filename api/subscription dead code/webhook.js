const crypto = require('crypto');
const {
  connectDb,
  getUserModel,
  setCorsHeaders,
} = require('../_lib/core');

function collectRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Maps a plan name to its corresponding tier name.
 * @param {string} plan Name of the plan.
 * @returns {string} Tier name for the plan.
 * @example
 * tierForPlan('studio') // 'studio'
 * tierForPlan('premium') // 'premium'
 * tierForPlan('basic') // 'starter'
 */
function tierForPlan(plan) {
  if (plan === 'studio') return 'studio';
  if (plan === 'premium') return 'premium';
  return 'starter';
}

function buildSubscriptionPeriodEnd(billingCycle, startDate = new Date()) {
  const next = new Date(startDate);
  if (billingCycle === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Razorpay webhook is not configured.' });
  }

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

    if (event?.event === 'payment.captured' && notes.googleId && notes.plan) {
      await User.updateOne(
        { googleId: notes.googleId },
        {
          $set: {
            subscriptionId: payment.id,
            subscriptionTier: tierForPlan(notes.plan),
            subscriptionStatus: 'active',
            subscriptionCurrentPeriodEnd: buildSubscriptionPeriodEnd(notes.billingCycle),
          },
        }
      );
    }

    if (event?.event === 'payment.failed' && notes.googleId) {
      await User.updateOne(
        { googleId: notes.googleId },
        { $set: { subscriptionStatus: 'inactive' } }
      );
    }

    if (event?.event === 'refund.processed' && notes.googleId) {
      await User.updateOne(
        { googleId: notes.googleId },
        {
          $set: {
            subscriptionTier: 'starter',
            subscriptionStatus: 'inactive',
            subscriptionCurrentPeriodEnd: null,
          },
        }
      );
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook handler failed:', err);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
};
