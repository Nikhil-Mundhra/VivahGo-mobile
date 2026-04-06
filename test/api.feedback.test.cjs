const assert = require('node:assert/strict');

const { resetRateLimitBuckets } = require('../api/_lib/core');
const { createRes } = require('./helpers/testUtils.cjs');

const handler = require('../api/system');
const feedbackHandlerPath = require.resolve('../api-handlers/system/feedback');

function csrfHeaders(headers = {}) {
  return {
    ...headers,
    cookie: ['vivahgo_csrf=test-csrf-token', headers.cookie].filter(Boolean).join('; '),
    'x-csrf-token': 'test-csrf-token',
  };
}

describe('api/system.js -> feedback route', function () {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(function () {
    process.env.FEEDBACK_WEBHOOK_URL = 'https://example.com/webhook';
    process.env.FEEDBACK_SECRET_KEY = 'server-secret';
  });

  afterEach(function () {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    resetRateLimitBuckets();
    delete require.cache[feedbackHandlerPath];
  });

  it('handles OPTIONS preflight with 204', async function () {
    const req = { method: 'OPTIONS', query: { route: 'feedback' }, headers: { origin: 'https://example.com' } };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.ended, true);
  });

  it('rejects non-POST methods', async function () {
    const req = { method: 'GET', query: { route: 'feedback' }, headers: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { error: 'Method not allowed.' });
    assert.equal(res.headers.Allow, 'POST, OPTIONS');
  });

  it('returns 500 when feedback env vars are missing', async function () {
    delete process.env.FEEDBACK_WEBHOOK_URL;
    const req = { method: 'POST', query: { route: 'feedback' }, headers: csrfHeaders(), body: { message: 'hello' } };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Feedback service is not configured.' });
  });

  it('forwards feedback with server secret', async function () {
    let forwarded = null;

    global.fetch = async function mockFetch(url, options) {
      forwarded = { url, options };
      return { ok: true, status: 200 };
    };

    const req = {
      method: 'POST',
      query: { route: 'feedback' },
      headers: csrfHeaders({ 'user-agent': 'test-agent' }),
      body: {
        name: 'Nikhil',
        email: 'nikhil@example.com',
        message: 'Great app',
        source: 'desktop-footer',
        appVersion: '1.0.0',
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(forwarded.url, 'https://example.com/webhook');

    const parsedBody = JSON.parse(forwarded.options.body);
    assert.equal(parsedBody.key, 'server-secret');
    assert.equal(parsedBody.message, 'Great app');
    assert.equal(parsedBody.userAgent, 'test-agent');
  });

  it('returns 400 when message is empty or whitespace', async function () {
    const req = { method: 'POST', query: { route: 'feedback' }, headers: csrfHeaders(), body: { message: '   ' } };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Feedback message is required.' });
  });

  it('returns 502 when webhook responds with a non-ok status', async function () {
    global.fetch = async () => ({ ok: false, status: 500 });

    const req = {
      method: 'POST',
      query: { route: 'feedback' },
      headers: csrfHeaders(),
      body: { message: 'Test message' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { error: 'Could not submit feedback right now. Please try again.' });
  });

  it('returns 502 when fetch throws a network error', async function () {
    global.fetch = async () => { throw new Error('Network failure'); };

    const req = {
      method: 'POST',
      query: { route: 'feedback' },
      headers: csrfHeaders(),
      body: { message: 'Test message' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { error: 'Could not submit feedback right now. Please try again.' });
  });

  it('falls back to req headers user-agent when body omits userAgent', async function () {
    let parsedBody = null;
    global.fetch = async (url, options) => {
      parsedBody = JSON.parse(options.body);
      return { ok: true };
    };

    const req = {
      method: 'POST',
      query: { route: 'feedback' },
      headers: csrfHeaders({ 'user-agent': 'header-agent' }),
      body: { message: 'Hello', name: 42 },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(parsedBody.userAgent, 'header-agent');
    assert.equal(parsedBody.name, 'Anonymous');
  });

  it('rate limits repeated feedback submissions from the same client IP', async function () {
    global.fetch = async () => ({ ok: true, status: 200 });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const req = {
        method: 'POST',
        query: { route: 'feedback' },
        headers: csrfHeaders({ 'x-forwarded-for': '198.51.100.25' }),
        body: { message: `Feedback ${attempt}` },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
    }

    const limitedReq = {
      method: 'POST',
      query: { route: 'feedback' },
      headers: csrfHeaders({ 'x-forwarded-for': '198.51.100.25' }),
      body: { message: 'One more' },
    };
    const limitedRes = createRes();

    await handler(limitedReq, limitedRes);

    assert.equal(limitedRes.statusCode, 429);
    assert.equal(limitedRes.headers['Retry-After'], '600');
    assert.deepEqual(limitedRes.body, { error: 'Too many feedback submissions. Please try again later.' });
  });
});
