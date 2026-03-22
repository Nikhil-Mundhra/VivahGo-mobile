const { handlePreflight, setCorsHeaders } = require('./_lib/core');

function getString(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  const secretKey = process.env.FEEDBACK_SECRET_KEY;

  if (!webhookUrl || !secretKey) {
    res.status(500).json({ error: 'Feedback service is not configured.' });
    return;
  }

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
    console.error('Feedback forward failed:', error);
    res.status(502).json({ error: 'Could not submit feedback right now. Please try again.' });
  }
};
