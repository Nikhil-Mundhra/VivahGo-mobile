const Stripe = require('stripe');
const {
  connectDb,
  getUserModel,
  setCorsHeaders,
} = require('../_lib/core');

// Raw body collection — Vercel does not parse body for this route.
// In vercel.json you don't need extra config; this handler reads raw stream directly.
function collectRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function tierForPlan(plan) {
  if (plan === 'studio') return 'studio';
  if (plan === 'premium') return 'premium';
  return 'starter';
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook is not configured.' });
  }

  const stripe = Stripe(stripeSecretKey);

  let rawBody;
  try {
    rawBody = await collectRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Failed to read request body.' });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    await connectDb();
    const User = getUserModel();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription && session.customer) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const googleId = subscription.metadata?.googleId || session.metadata?.googleId;
        const plan = tierForPlan(subscription.metadata?.plan || '');
        if (googleId) {
          await User.updateOne(
            { googleId },
            {
              $set: {
                stripeCustomerId: session.customer,
                subscriptionId: session.subscription,
                subscriptionTier: plan,
                subscriptionStatus: 'active',
                subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
              },
            }
          );
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const googleId = subscription.metadata?.googleId;
      if (googleId) {
        const stripeStatus = subscription.status; // active, past_due, canceled, etc.
        const appStatus = ['active', 'past_due'].includes(stripeStatus)
          ? stripeStatus
          : 'inactive';
        const plan = tierForPlan(subscription.metadata?.plan || '');
        await User.updateOne(
          { googleId },
          {
            $set: {
              subscriptionId: subscription.id,
              subscriptionTier: appStatus === 'active' ? plan : 'starter',
              subscriptionStatus: appStatus,
              subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          }
        );
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const googleId = subscription.metadata?.googleId;
      if (googleId) {
        await User.updateOne(
          { googleId },
          {
            $set: {
              subscriptionTier: 'starter',
              subscriptionStatus: 'inactive',
              subscriptionCurrentPeriodEnd: null,
            },
          }
        );
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      if (customerId) {
        await User.updateOne(
          { stripeCustomerId: customerId },
          { $set: { subscriptionStatus: 'past_due' } }
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler failed:', err);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
};
