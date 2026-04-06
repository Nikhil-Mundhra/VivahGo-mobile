const { applyRateLimit, handlePreflight, requireCsrfProtection, setCorsHeaders } = require('../../api/_lib/core');

function getString(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

module.exports = async function handleFeedback(req, res) {
  // ---------------------
  // Request guardrails
  // ---------------------
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (requireCsrfProtection(req, res, { skipForBearer: false })) {
    return;
  }

  if (applyRateLimit(req, res, 'feedback:submit', {
    windowMs: 10 * 60 * 1000,
    max: 6,
    message: 'Too many feedback submissions. Please try again later.',
  })) {
    return;
  }

  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  const secretKey = process.env.FEEDBACK_SECRET_KEY;

  if (!webhookUrl || !secretKey) {
    res.status(500).json({ error: 'Feedback service is not configured.' });
    return;
  }

  // ---------------------
  // Payload normalization
  // ---------------------
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const message = getString(body.message, '');

  if (!message) {
    res.status(400).json({ error: 'Feedback message is required.' });
    return;
  }

  const payload = {
    key: secretKey,
    name: getString(body.name, 'Anonymous'),
    email: getString(body.email, 'Not provided'),
    message,
    source: getString(body.source, 'web-client'),
    userAgent: getString(body.userAgent, req.headers['user-agent'] || 'unknown'),
    appVersion: getString(body.appVersion, '1.0.0'),
  };

  try {
    // ---------------------
    // Webhook forward
    // ---------------------
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Feedback webhook returned ${response.status}`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    // ---------------------
    // Error handling
    // ---------------------
    console.error('Feedback forward failed:', error);
    res.status(502).json({ error: 'Could not submit feedback right now. Please try again.' });
  }
};
