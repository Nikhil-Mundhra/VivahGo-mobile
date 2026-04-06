const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');

const handler = require('../api/system');
const healthHandlerPath = require.resolve('../api-handlers/system/health');

describe('api/system.js -> health route', function () {
  afterEach(function () {
    delete require.cache[healthHandlerPath];
  });

  it('returns ok payload for GET', async function () {
    const req = { method: 'GET', query: { route: 'health' }, headers: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(res.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization, X-CSRF-Token');
    assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  });

  it('handles OPTIONS preflight with 204 and no JSON body', async function () {
    const req = { method: 'OPTIONS', query: { route: 'health' }, headers: { origin: 'https://example.com' } };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.body, null);
    assert.equal(res.ended, true);
  });
});
