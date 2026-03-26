const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const r2Path = require.resolve('../api/_lib/r2');
const handlerPath = require.resolve('../api/media/verification-presigned-url');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'vendor-123', email: 'vendor@test.com', name: 'Vendor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/media/verification-presigned-url.js', function () {
  const originalCore = require(corePath);
  const originalR2 = require(r2Path);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    require.cache[r2Path].exports = originalR2;
    delete require.cache[handlerPath];
  });

  it('returns a private verification upload key', async function () {
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
    };
    require.cache[r2Path].exports = {
      ...originalR2,
      createPresignedPutUrl: async () => 'https://upload.example.com/put',
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        filename: 'pan-card.pdf',
        contentType: 'application/pdf',
        size: 2048,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.uploadUrl, 'https://upload.example.com/put');
    assert.match(res.body.key, /^vendor-verification\/vendor-123\/.+\.pdf$/);
  });
});
