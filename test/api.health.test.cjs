const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');

const handler = require('../api/health');

describe('api/health.js', function () {
  it('returns ok payload for GET', async function () {
    const req = { method: 'GET', headers: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(res.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization');
    assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  });

  it('handles OPTIONS preflight with 204 and no JSON body', async function () {
    const req = { method: 'OPTIONS', headers: { origin: 'https://example.com' } };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.body, null);
    assert.equal(res.ended, true);
  });
});
